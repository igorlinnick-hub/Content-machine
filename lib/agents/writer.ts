import type {
  SharedContext,
  WriterOutput,
  ScriptLengthTarget,
  RolePlan,
  RoleBlock,
  PlanContext,
} from '@/types'
import type { ArsenalBeat } from '@/lib/arsenal/store'
import { MODEL_DEFAULT, callAgentJSON } from './base'
import { getNicheProfile, type NicheProfile } from '@/lib/niche/profiles'
import { getFormat } from '@/lib/posts/formats'

// A single reference video pinned as THE format to use (Studio). When
// present, the Writer drops the "pick one of N templates" choice and
// must follow this exact scaffold, anchored to the reference video's
// actual structure / transcript.
export interface PinnedFormat {
  templateName: string
  scaffold: string
  description?: string | null
  // When set, the Writer also emits role_blocks using ONLY these speakers.
  rolePlan?: RolePlan | null
  reference?: {
    styleDescription?: string | null
    transcriptExcerpt?: string | null
    beats?: ArsenalBeat[]
    hookVisual?: string | null
    brollPattern?: string | null
  } | null
}

// Canonical full_script is the join of role_blocks, so the two can never
// disagree (downstream caption/slide/critic all key off full_script).
export function joinRoleBlocks(blocks: RoleBlock[]): string {
  return blocks
    .filter((b) => b.speaker !== 'Operator' && b.text?.trim())
    .map((b) => b.text)
    .join('\n\n')
}

interface LengthSpec {
  label: 'short' | 'long'
  word_min: number
  word_max: number
  seconds_min: number
  seconds_max: number
  hookWords: number
  scienceWords: number
  approachWords: number
  ctaWords: number
}

const LENGTH_SPECS: Record<ScriptLengthTarget, LengthSpec> = {
  short: {
    label: 'short',
    word_min: 200,
    word_max: 220,
    seconds_min: 80,
    seconds_max: 90,
    hookWords: 35,
    scienceWords: 45,
    approachWords: 90,
    ctaWords: 30,
  },
  long: {
    label: 'long',
    word_min: 420,
    word_max: 540,
    seconds_min: 150,
    seconds_max: 180,
    hookWords: 60,
    scienceWords: 110,
    approachWords: 220,
    ctaWords: 50,
  },
}

// The niche-persona line is the ONLY part of the base prompt that varies
// between clinics. Everything else — voice guidance, hard rules, input spec —
// is universal across niches.
const SYSTEM_PROMPT_BASE_SHARED = `Voice: a smart, calm doctor explaining things plainly to someone in their chair. Plain English. Short sentences. Concrete everyday comparisons. No medical jargon unless it is immediately unpacked in lay terms (e.g. "your platelets — the part of your blood that helps healing"). Banned phrases: "as a clinician", "in our practice we observe", "the literature suggests", "peer-to-peer", "from a clinical standpoint". Allowed registers: "if you're considering this", "what this means for you", "what to look out for", "why this matters". Do NOT copy-paste a generic "educational / professional / conversational" register. The exact tone is inferred from the FEW-SHOT EXAMPLES and the DOCTOR'S RECENT PICKS.

NO CLICHÉS — SOUND LIKE A DOCTOR, NOT AN INFLUENCER SCRIPT OR AD COPY (HARD — applies to the hook AND every sentence after it):
The lists below are EXAMPLES OF CATEGORIES, not an exhaustive blocklist. Anything that sounds like YouTube retention bait, ChatGPT, or a marketing funnel — even if it is not listed here — is out. The test for every sentence: would a calm doctor say this across the desk to one patient? If it sounds like a script talking to an audience, rewrite it.
1. Teaser / announcer lines — a sentence that ANNOUNCES content instead of CARRYING it: "Here's why that's already too late.", "Here's what's actually happening.", "Here's the thing / the catch / the kicker / what most people miss.", "But here's why…", "Let me explain.", "Let's break it down.", "Stay with me.", "Keep watching.", "Wait for it.", "You won't believe…", "What nobody tells you…", "Most people don't know this.", "The truth is:", "This is where it gets interesting.", "That changes everything.", "Let that sink in.", "More on that later.". Test: delete the sentence — if the script loses nothing, it was a teaser. Right: "Wrinkles show up in your 30s, but the bone under them started thinning at 25." Wrong: "Wrinkles show up in your 30s. Here's why that's already too late." When a hook ends on a question, the NEXT sentence is the answer — not a promise to answer.
2. Strawman openers — "Most people think…", "The standard story is…", "Everyone talks about X, but…", "You've probably heard…", "Conventional wisdom says…", "Sound familiar?", "You're not alone." At most ONE per script, and only if the misconception is real and named concretely. Default: skip the strawman and state the fact.
3. Marketing / AI filler — "game-changer", "unlock", "journey", "dive in / deep dive", "at the end of the day", "the bottom line", "it's important to note", "plays a key / crucial role", "when it comes to", "in today's world", "let's be honest / real", "the good news is", "no, really", "and that's okay", "significantly", "in many cases", "holistic", "optimize", "empower", "transform your…". Cut them; say the concrete thing.
4. The tidy antithesis bow — "It's not X, it's Y.", "Same drug, different outcome.", "The problem was never A — it's B." At most ONE in a whole script, and the script is better with none.
5. Rule-of-three abstract-noun lists ("sleep, stress and inflammation all play a role") — pick ONE concrete thing and make it real. Perfectly parallel, symmetric sentences read machine-made; real speech is uneven.
6. Ending every beat on a neat wrap-up line. Sometimes just stop on the useful detail.

HARD RULES:
- No medical promises ("will cure", "guaranteed", "100%", "always works").
- Only facts with scientific grounding. If you cannot back something, do not write it.
- Follow the LENGTH SPEC and the FORMAT TEMPLATE you choose. Both are mandatory.

FACT-ACCURACY RULES (the compliance gate flags each of these — write so it has nothing to flag):
- No specific numeric statistic (percentage, patient count, response rate, time-to-result) unless the SAME sentence names its source (trial acronym, journal, institution) — and even then hedge the number ("roughly", "about"). No source at hand → qualitative phrasing: "many patients", "studies suggest", "a meaningful share of patients".
- No years/dates for FDA approvals or trial results. Say "FDA-cleared for X" — never "since 2008" / "approved in 2023".
- Dosages and protocol specifics always carry "typically" / "commonly", or stay general ("over several weeks").
- No currency claims: "currently", "as of [year]", "the only FDA-approved". State facts without a time anchor.

INPUTS YOU WILL USE:
- content_pillars: every variant MUST map to one pillar — stay inside the clinic's territory.
- deep_dive_topics: when you pick a topic adjacent to one of these, go deeper and more mechanism-level.
- raw_insights: mine stories, opinions, angles, and hooks from here — especially the clinic's own contrarian opinions. Prefer real clinic material over generic content.
- few_shot_library: voice / tone reference (HOW it sounds).
- format_templates: structural scaffolds (HOW it is laid out — system critique, diagnostic deep-dive, patient story, etc). Pick ONE template per variant. Different variants should pick different templates when possible.
- diff_rules: mandatory — every rule must be followed in the output.
- trend_signals: use for timely topics (do not mention that they are "trending").
- content_memory: topics and hooks already shipped — do NOT repeat them.
- DOCTOR'S RECENT PICKS: the doctor selected these from previous rounds. Their topic/hook/cadence patterns are what works — lean toward them.
- DOCTOR'S RECENT REJECTS: the doctor passed on these. Avoid their topic angles, hook shapes, and framings.

ALWAYS produce exactly the requested number of variants. Make them genuinely different — different pillars, different formats, or the same pillar from different angles. Do not produce minor rewordings of the same idea. Each variant must declare which template_name it followed.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "variants": [
    {
      "id": "v1",
      "topic": "...",
      "hook": "...",
      "script": "...",
      "word_count": 210,
      "estimated_seconds": 88,
      "template_name": "..."
    }
  ]
}`

/** Build the base system prompt with niche-specific persona injected at the top. */
function buildSystemBase(profile: NicheProfile): string {
  return `${profile.writerPersona}\n\n${SYSTEM_PROMPT_BASE_SHARED}`
}

// Appended to the base system prompt for the POST CAROUSEL pipeline
// (HANDOFF-POSTS.md §17.3 + §18). NOT used for video / arsenal flows.
// Toggled via RunWriterParams.postCarouselMode.
//
// Locks the writer to:
//   • structural arc (cover → mechanism → analogy → evidence → application → CTA)
//   • niche-specific CTA mode (manychat keyword vs. booking)
//   • niche-specific compliance baseline
//   • mental-health-acute stripped template when the topic matches §18.1 triggers
//   • Sources go to a separate metadata block, NEVER to the caption

const SLIDE_ARC_BLOCK = `SLIDE ARC (in order):
  Slide 1   Cover                  — title (mixed case) + hook: one concrete claim, optionally followed by a short contrast or question line. NEVER append "Swipe →" or any swipe prompt — the platform UI handles that.
  Slide 2   Mechanism / Real cause — heading + intro + 3 bullets + close. Explain the ACTUAL biology in concrete detail: name the hormone / pathway / tissue and what it physically does. This is the deepest slide of the post — never thin it out.
  Slide 3   Gap slide (optional)   — "why standard care misses this" — include WHEN the post explains an insurance / 15-min-visit / equipment-cost reason standard medicine skips the better option; SKIP for how-to / multi-pathway / acute topics
  Slide 4   Analogy                — sticky analogy in plain prose, no bullets. e.g. "X is like Y — [the punchline]". The heading must NEVER be "Think of it this way" — that exact phrase shipped on every post and now reads as a template. Title this slide by what the analogy MEANS for the reader. SKIP for mental-health-acute topics (see below).
  Slide 5   Evidence               — bullets with real evidence markers (FDA approval dates, named trials, qualitative findings). Pull exact dates and trial names from the VERIFIED FACTS block and back every claim in sources[]. NEVER invent a percentage or statistic. If VERIFIED FACTS gives you no number, trial name or date for this topic, do NOT write a "what the data shows" heading and fill it with vague reassurance — a heading that promises data the slide doesn't have is a failed slide. RETITLE it to what the slide actually delivers (the test to ask for, the question to bring to the visit, what to track) and give the reader that concrete thing instead.
  Slide 6   Who it's for           — bullets + close
  Slide 7   Session / protocol     — optional
  Slide 8   Why it's underused     — optional
  Final     CTA stack              — see CTA STACK FORMAT below

SLIDE SHAPE — VARY IT (do NOT cut depth): give consecutive slides DIFFERENT
shapes so the carousel breathes. Rotate among:
  - a short two-beat paragraph;
  - a lead-in line + 2-3 short sub-points (each a real concrete point, never padded);
  - a single vivid sentence;
  - a FULL mechanism slide with its detail;
  - a CONCRETE COMPARISON — two labeled sides stating real facts, e.g.
    "Cortisone → calms the pain fast, doesn't touch the cause." /
    "A2M → targets the enzymes breaking the cartilage down." This is a factual
    side-by-side, NOT the banned rhetorical antithesis bow — it names real
    things on each side and teaches, it doesn't just flip a phrase.
  - a RESEARCH STATEMENT — a named study stated as one crisp line instead of a
    paragraph, e.g. "STEP trial: studied weight change over 68 weeks under
    medical supervision." (still backed in sources[]; never invent numbers.)
Never use the same shape twice in a row. This governs SHAPE, not LENGTH — keep
every mechanism, number and named study intact. Depth first, variety second.`

// WATERFALL (Igor 2026-08-12). The arc above lists the STATIONS; on its own it
// produced posts that circle instead of descending — slide 4 restating slide 2,
// a "data" heading with no data, every slide ending nowhere. This block is what
// chains the stations together and makes each one land.
const WATERFALL_BLOCK = `WATERFALL — THE POST MUST DESCEND, NOT CIRCLE (BINDING):

The slide arc is a list of STATIONS. It is not the logic. The logic is this:
**every slide must answer the question the previous slide just raised in the
reader's head, and end by raising the next one.** Before you write slide N, say
in one sentence what the reader is now wondering after slide N-1, and answer
THAT. A post where the slides could be reordered without damage has failed.

Each body slide therefore ends with a TAKEAWAY: one short line (6-10 words),
on its own line after a blank line, that lands the slide. This is REQUIRED —
a station that only delivers information and stops leaves the reader asking
"and what does that give me?"

A takeaway ADDS something — a consequence, a criterion, an action, a limit.
It is NOT a restatement of the slide's own body in nicer words. Eight shapes
that work (use them as TYPES, never copy the wording):
  1. Consequence         — "Rest calms the pain. The enzymes keep going."
  2. Answers the unasked "why" — "That's why relief has a shelf life."
  3. What to measure     — "That's the number worth measuring."
  4. Permission / de-escalation — "Feeling off with a normal number is a reason to look closer."
  5. The small lever     — "One extra line on the order changes the answer."
  6. An honest limit     — "A baseline needs more than a single number."
  7. Compresses a list   — "Four numbers, one picture."
  8. Lowers the alarm    — "Nothing here is urgent. It's just worth knowing."

The takeaway is NOT the banned antithesis bow. The difference is testable:
a takeaway carries information that is not already in the slide body; a bow
only rearranges words already on the slide ("It's not X, it's Y", "Same A,
different B", "The problem was never…", "At the end of the day…"). Bows stay
banned — at most ONE in the whole post, and the post is better with none.

HAND-OFF — how a takeaway feeds the next slide. Use one of:
  • it names a LIMIT      → the next slide closes it
  • it raises an OBJECTION → the next slide answers it
  • it gives a CRITERION   → the next slide shows how to get it

NO SLIDE REPEATS ANOTHER (HARD): each body slide must carry a fact, distinction
or instruction that no earlier slide already made. Restating an earlier point in
new words is a FAILED variant — the reader notices immediately and stops
reading. Before finishing, re-read your slides in order and delete any slide
that would leave the post intact if removed.

THE COVER MUST BE PAID OFF (HARD): if the hook raises something ("the one number
your panel missed", "the loop behind the 3pm crash"), one specific body slide
must actually deliver it. An unpaid hook is a failed variant. (And the hook
still states a thing, never "here's the…" — see NO CLICHÉS.)`

const VOICE_BLOCK = `VOICE — HOW IT SHOULD SOUND (BINDING):
Write like the doctor is talking to ONE patient across the table — clear, warm,
genuinely useful. The register is educational and a little surprising; NEVER
scolding, alarmist, or superior. Keep the honest hard part (what hurts, what
didn't work), but always turn it toward what it means and what's possible next.
Encouraging, not hype. When you name a pain point, it's to help the reader
understand it — not to indict their old doctor or scare them.

SOUND HUMAN, NOT AI (BINDING) — the patterns below make copy read like a generic
template ("заготовка"). They are the difference between real and machine-made:
  ✗ Rule-of-three lists of abstract nouns — "gut receptor sensitivity, liver
    clearance rate, and lean muscle mass all change how the drug behaves."
    → Pick ONE concrete thing and make it real: "if you've lost muscle over the
      years, the same dose can hit you harder than it hits someone else."
  ✗ The tidy antithesis "summary bow" — "Same drug, same schedule — very
    different outcomes", "It's not X, it's Y", "The problem was never A — it's B."
    This is the #1 AI tell. At most ONE such line in the WHOLE post, if any.
  ✗ Filler / throat-clearing — "significantly", "varies significantly", "plays a
    key/crucial role", "it's important to note", "when it comes to", "in many
    cases", "isn't uniform." Cut them; say the concrete thing instead.
  ✗ Perfectly parallel, symmetric prose. Real speech is uneven — put a 3-word
    sentence next to a 20-word one. Use contractions and plain verbs.
  ✗ Ending every slide on a neat rhetorical wrap-up — a line that sounds like a
    conclusion but only re-says the slide. NOTE: this bans the empty BOW, not
    the takeaway. Every body slide still ends on a real takeaway that adds a
    consequence, criterion, action or limit — see the WATERFALL block, which
    governs when the two conflict.
One small, specific, human observation beats three polished generalities.`

const READABILITY_RAMP_BLOCK = `READABILITY & RAMP (BINDING — Igor 2026-08-19, the BPC-157 tips lesson):
The reader is an ordinary person scrolling. The test for every sentence: would a
smart 14-year-old get it on the first read? This is NOT "dumb it down" — the
science stays; the sentences carrying it get simple.

1. TERMS — the plain phrase does the work, the term tags along in parentheses on
   first use: "common painkillers like ibuprofen (NSAIDs)", "the repair signals
   your body sends after an injury". If the term never appears again, drop it
   entirely. NEVER lead with the acronym and explain later — by then the reader
   is gone. This applies to slide 2 hardest of all: it is the door into the post.
2. HEDGES get their own short sentence. Compliance qualifiers ("in animal
   studies", "not FDA-approved", "investigational") must NEVER be wedged
   mid-clause. Wrong (shipped 2026-08-19, unreadable): "NSAIDs may blunt the
   inflammatory signals BPC-157 is thought — in preclinical models — to
   influence." Right: "Common painkillers like ibuprofen may work against the
   very signals BPC-157 uses. So far that's from animal studies — human data
   isn't in yet." Same facts, same compliance, readable.
3. ONE idea per sentence, ONE qualifier per sentence, no sentence over ~18
   words. A nested sentence with two em-dash asides is a rewrite, not a style.
4. DIFFICULTY RAMPS UP, NEVER DOWN. Slide 2 is the EASIEST body slide — it
   starts from the reader's everyday situation in the reader's own words (what
   they feel, do, or worry about), not from mechanism. Depth builds toward the
   middle of the post. A post whose two hardest slides come first and whose rest
   coasts is a failed post, even if every fact is right.
5. BRIDGE EVERY SLIDE. The first line of each body slide picks up something the
   previous slide left — its takeaway, its open question, or its key word — so
   the reader never has to jump a gap. In list formats the bridge is the ORDER:
   items run in the order the reader would actually do them (before → during →
   after), and the cover frames that order. If two adjacent slides could be
   swapped with no damage, the seam between them is missing — write it.`

const MENTAL_HEALTH_ACUTE_BLOCK = `MENTAL-HEALTH-ACUTE STRIPPED TEMPLATE:
When topic or hook contains any of: "suicid", "self-harm", "self harm", "acute ideation", "active ideation", "988", "lifeline", "crisis intervention" — switch to the stripped template:
  • NO analogy slide at all
  • CTA = Comment "<KEYWORD>" only + crisis line
  • Caption MUST end with the 988 crisis line
  • Tone stays clinical and supportive. NEVER "system failed you" / "you deserve better" framing.`

const COMPLIANCE_WALL_BLOCK = `COMPLIANCE WALL — INSTANT DISQUALIFICATION (these phrases make a post unpublishable):
  ✗ "[therapy] treats [disease/condition]"    → use "may support" / "studied for"
  ✗ "[therapy] cures / reverses / heals"      → never use these verbs on a disease
  ✗ "you will see results" / "guaranteed" / "100% effective" / "always works"
  ✗ A therapeutic post with zero hedging phrases — ALWAYS include at least one:
      "may help", "can support", "some patients", "studies suggest", "talk to your doctor"

If you are tempted to write any of the above → stop, rephrase before finishing the variant. A variant with ANY of these will be rejected by the downstream compliance gate and the whole post must be regenerated.`

/**
 * Build the POST CAROUSEL system-prompt block for the given niche profile.
 * Replaces the former SYSTEM_PROMPT_POSTS constant.
 * clinicName is used in the intro sentence.
 * socialHandle is the Instagram handle (without '@') or null.
 */
function buildSystemPosts(
  profile: NicheProfile,
  clinicName: string,
  socialHandle: string | null
): string {
  const followLine = socialHandle
    ? `@${socialHandle} for evidence-based ${profile.label} content, no hype.`
    : `us for evidence-based ${profile.label} content, no hype.`

  let ctaStackBlock: string
  if (profile.ctaMode === 'manychat') {
    ctaStackBlock = `CTA STACK FORMAT (always 3 lines unless mental-health-acute):
  Follow → ${followLine}
  Comment → "<KEYWORD>" and we'll <what we send>.
  Book → tap the link in bio or DM us to start an evaluation.

${profile.manychatKeywordsBlock ?? ''}`
  } else {
    // booking mode — no Comment KEYWORD line
    ctaStackBlock = `CTA STACK FORMAT (always 2 lines — NO comment/keyword line for this clinic):
  Follow → ${followLine}
  Book → DM us or tap the link in bio to book a consultation.

Do NOT include a "Comment <KEYWORD>" line. This clinic uses direct booking only.`
  }

  const goldStdLine = profile.writerGoldStandardRef
    ? `\n${profile.writerGoldStandardRef}\n`
    : ''

  return `

POST CAROUSEL MODE (active for this request):
You are writing for ${clinicName}'s Instagram carousel pipeline. Every variant MUST follow the universal structural arc below. This is non-negotiable.

${SLIDE_ARC_BLOCK}

${WATERFALL_BLOCK}

${VOICE_BLOCK}

${READABILITY_RAMP_BLOCK}

${ctaStackBlock}

${MENTAL_HEALTH_ACUTE_BLOCK}

${COMPLIANCE_WALL_BLOCK}

COMPLIANCE BASELINE (HARD — every variant must pass):
${profile.complianceFacts}

OUTPUT SHAPE (POST CAROUSEL):
The "script" field of each variant is the full carousel rendered as readable text — cover line + each numbered slide + CTA stack. The compliance gate reads this; downstream the splitter parses it into the slide_sets row.

CAROUSEL LENGTH — GRID BUDGET (OVERRIDES the "LENGTH SPEC / word count" above;
Igor 2026-08-10, supersedes the old "fill to 55-100 words" rule):
The master templates use a BIG FIXED font (body 46pt / title 50pt), so text must
be SHORT to fit the grid. Editorial rhythm (danbuettner style): a punchy heading
+ ONE short idea. Rules:
- **Each BODY slide is 20-28 words TOTAL** — a BAND, not a ceiling. Aim for the
  middle. Slides in one post must not swing from 17 to 29 words; that reads as
  an accident, not as rhythm (Igor 2026-08-12).
- That total splits as: **body 14-18 words + takeaway 6-10 words**, separated by
  a blank line. The takeaway is budgeted SEPARATELY — never drop it to fit the
  body under a limit; cut the body instead.
- The body is EITHER one short paragraph (1-2 sentences) OR a list of 3-4 items
  of ≤ ~6 words each. Not both. The takeaway line comes after either one.
- Prefer a statement + a single supporting line over a wall of points.
- Do NOT stack lead-in + multi-point + closing on one slide — pick ONE shape.
- Text must fit the panel at the fixed font. A slide that would overflow is a
  FAILED variant — cut words, NEVER assume the font shrinks.
- Keep the whole post lean: cover ≤ ~18 words, CTA ≤ ~12 words.

SLIDE HEADINGS (HARD): each body slide's heading must be SHORT (≤ ~5 words / 24
chars) AND clear on its own — never a long sentence, never a cryptic
abbreviation. "Myth 1: Total testosterone tells the whole story" is too long (it
gets truncated to junk like "TOTAL T", Igor 2026-08-03); write "Myth 1: Not just
total" instead. Put the full idea in the body, not the heading.

A heading CARRIES THE READER'S QUESTION — it does not name the section
(Igor 2026-08-12). Four kinds that work:
  • the reader's objection — "So why did the shot wear off", "Normal for who?"
  • where the limit is     — "Where the panel stops", "One draw is one moment"
  • the lever              — "The test to ask for", "What to change first"
  • the stake for THEM     — "What this means for your knee"
BANNED as headings — section labels that could sit on any post of any topic:
"What's happening", "What the data shows", "Think of it this way", "The
science", "Overview", "Key takeaway", "Why it matters". If a heading would fit
unchanged on a post about a different condition, it is a label — rewrite it.
("Who it's for" is the one allowed exception: it is a recognition slide and
readers use it to self-select.)

MINIMUM COVERAGE (HARD): a carousel is cover + at least FOUR body slides
(mechanism, evidence, who-it's-for at minimum) + CTA. A post with fewer body
slides is a failed variant.

SOURCES (HARD): after the CTA stack, append a "SOURCES" section — one line per
non-trivial factual claim in the post, format: "<claim> — <citation>" (journal /
trial name / FDA action + year from the VERIFIED FACTS block). These lines are
parsed into metadata and never rendered on slides. A post whose data slide has
no matching source line is a failed variant.
${goldStdLine}`
}

// Appended to the base system prompt only when a pinned format requests
// role assignment (Studio). Adds role_blocks to the schema. The model
// returns role_blocks; the server derives full_script by joining them.
const SYSTEM_PROMPT_ROLES = `

ROLE MODE (active for this request):
This is a SHOOT BRIEF for the clinic's own staff — NOT professional actors — to film. Make it simple and doable.

SETTING (hard): everything is filmed INSIDE THE CLINIC (treatment room, hallway, reception, equipment). Never outdoors. Never reference a location the clinic doesn't have.
ADAPT, don't copy: take the reference video's FORMAT (its structure / pacing / hook style) and rebuild it as something THIS clinic can actually shoot for ITS niche and services.

Every variant MUST add two fields:

1. "summary_steps" — 3 to 5 short, plain-English steps telling the team WHAT to film, in order (e.g. "Doctor stands by the treatment table, phone vertical", "Close-up on the equipment for 2 seconds", "Doctor delivers the CTA looking straight at lens"). Simple enough for a non-actor to follow. This is where all filming/setup guidance goes.

2. "role_blocks" — the script broken into spoken beats. Use ONLY the allowed speakers listed in the FORMAT block. Speakers are people who speak ON CAMERA. Do NOT include post-production editing instructions (overlays, graphics, cuts) — those belong in summary_steps, not role_blocks. Each block is one spoken beat.

The "script" field must be the plain spoken text of the blocks in order (no speaker labels). All output in ENGLISH.

Each variant's JSON gains:
  "summary_steps": ["...", "...", "..."],
  "role_blocks": [
    { "speaker": "Doctor", "text": "..." },
    { "speaker": "Patient", "text": "..." }
  ]`

function buildLengthSpecBlock(target: ScriptLengthTarget): string {
  const spec = LENGTH_SPECS[target]
  return `LENGTH SPEC — TARGET: ${spec.label.toUpperCase()} (${
    spec.label === 'short' ? '~90s boost cut' : '~2.5min organic'
  })
- Word count: ${spec.word_min}-${spec.word_max} words. Count before you finish.
- Estimated seconds: ${spec.seconds_min}-${spec.seconds_max}.
- Beat budget (in order):
  1. Hook — ~${spec.hookWords} words. Concrete fact or question, not a generic opening. End it on the fact itself — never on a teaser line ("Here's why…", "Here's what's actually happening", "Let me explain").
  2. Science / fact — ~${spec.scienceWords} words. What the research actually shows.
  3. Clinic approach — ~${spec.approachWords} words. How we do this differently. Use the chosen FORMAT TEMPLATE here — that's where the structural variety lives.
  4. Call to action — ~${spec.ctaWords} words. One specific action.`
}

function buildPinnedFormatBlock(pf: PinnedFormat): string {
  const lines: string[] = [
    `FORMAT — you MUST follow this exact format (do not pick another). It is modelled on a real high-performing reference video.`,
    `=== ${pf.templateName} ===`,
  ]
  if (pf.description) lines.push(pf.description)
  lines.push(pf.scaffold)
  const ref = pf.reference
  if (ref) {
    if (ref.styleDescription)
      lines.push(`\nWhat makes the reference work: ${ref.styleDescription}`)
    if (ref.beats && ref.beats.length)
      lines.push(
        `Reference beat structure:\n${ref.beats
          .map((b) => `• ${b.name} — ${b.text.slice(0, 120)}`)
          .join('\n')}`
      )
    if (ref.hookVisual) lines.push(`Reference hook visual: ${ref.hookVisual}`)
    if (ref.brollPattern) lines.push(`Reference b-roll pattern: ${ref.brollPattern}`)
    if (ref.transcriptExcerpt)
      lines.push(
        `Reference transcript (excerpt — match the energy/cadence, NOT the words):\n${ref.transcriptExcerpt.slice(0, 800)}`
      )
  }
  if (pf.rolePlan && pf.rolePlan.speakers.length) {
    lines.push(
      `\nALLOWED SPEAKERS (role_blocks must use only these): ${pf.rolePlan.speakers.join(', ')}${
        pf.rolePlan.guidance ? `\nRole guidance: ${pf.rolePlan.guidance}` : ''
      }`
    )
  }
  return lines.join('\n')
}

function buildContextBrief(
  ctx: SharedContext,
  target: ScriptLengthTarget,
  feedback?: string,
  pinnedFormat?: PinnedFormat,
  excludeHooks?: string[],
  planContext?: import('@/types').PlanContext | null,
  postCarouselMode?: boolean,
  formatOverride?: string | null
): string {
  const parts: string[] = []

  parts.push(buildLengthSpecBlock(target))

  const p = ctx.clinic_profile
  parts.push(
    `CLINIC PROFILE:
- Name: ${p.name}
- Doctor: ${p.doctor_name || 'n/a'}
- Services: ${p.services.join(', ') || 'n/a'}
- Medical restrictions: ${p.medical_restrictions.join('; ') || 'none'}`
  )

  if (p.content_pillars.length) {
    parts.push(
      `CONTENT PILLARS (every variant must map to one):\n${p.content_pillars
        .map((x) => `- ${x}`)
        .join('\n')}`
    )
  }

  if (p.deep_dive_topics.length) {
    parts.push(
      `DEEP-DIVE TOPICS (go long-form and mechanism-level here):\n${p.deep_dive_topics
        .map((x) => `- ${x}`)
        .join('\n')}`
    )
  }

  // Resolve which template(s) to show. Priority:
  // 1. pinnedFormat (Studio: reference video drives the format)
  // 2. formatOverride (the marketer pressed a format button for THIS post)
  // 3. planContext.format (Content Plan: planner pre-assigned the format)
  // 4. length-biased random pick from all templates
  const planPinnedName = formatOverride?.trim() || planContext?.format || null
  const planPinnedTemplate = planPinnedName
    ? ctx.format_templates.find((t) => t.name === planPinnedName) ?? null
    : null

  if (pinnedFormat) {
    // Studio: one format pinned to a reference video.
    parts.push(buildPinnedFormatBlock(pinnedFormat))
  } else if (planPinnedTemplate) {
    // Content Plan: planner pre-assigned a specific structural format.
    // Carousel mode: the template supplies the ANGLE (how to hook, how
    // to argue) — the SLIDE ARC still governs slide count and coverage.
    // Following the 5-beat video scaffold literally shrank posts to 2
    // body slides (2026-07-23 regression).
    // Some formats ARE a structure, not an angle: a "top 5 tips" post is a
    // list all the way down, and forcing it through the universal arc
    // (mechanism → analogy → evidence) produced an explainer with one
    // checklist slide bolted on. Those formats carry their own arc and it
    // REPLACES the default one for this post. Angle formats have no arc of
    // their own and keep the default, which already suits them.
    const pinnedCatalogFormat = getFormat(planPinnedTemplate.name)
    const formatArc = postCarouselMode
      ? pinnedCatalogFormat?.carouselArc ?? null
      : null
    // The cover headline sells the FORMAT, not the topic word — the topic
    // already lives in the style pill and the hook. Igor 2026-08-20: a tips
    // post shipped with the bare word "PEPTIDES" as its cover; the promise
    // ("Four Things To Know") is what earns the swipe.
    const coverTitleBlock =
      postCarouselMode && pinnedCatalogFormat?.coverTitle
        ? `\n\nCOVER TITLE (BINDING): the cover's title line is the FORMAT'S PROMISE, 3-6 words, Mixed Case, in the shape: ${pinnedCatalogFormat.coverTitle}. If the title names a count, it must match the post's real item count. Do NOT use the bare topic word as the title — it already sits in the pill; the hook carries the topic specifics.`
        : ''

    parts.push(
      formatArc
        ? `FORMAT — this post is written as "${planPinnedTemplate.name}", and that format OWNS THE STRUCTURE. The arc below REPLACES the default SLIDE ARC in the system prompt for this post: follow this one, ignore the default station list. Everything else in the system prompt still binds — the waterfall (each slide answers what the previous raised, each body slide ends on a takeaway), the voice and cliché rules, the CTA STACK FORMAT, and the compliance wall.\n\n${formatArc}\n\n${planPinnedTemplate.description ? `${planPinnedTemplate.description}\n\n` : ''}${planPinnedTemplate.scaffold}${coverTitleBlock}`
        : postCarouselMode
        ? `FORMAT — this post uses the "${planPinnedTemplate.name}" template for its ANGLE and voice: how it hooks, what stance it takes, how it argues. Map the template's narrative beats ONTO the slide arc's slides — the SLIDE ARC governs the carousel structure, and every variant must still deliver the arc's full coverage (deep mechanism, "What the data shows" with real evidence, "Who it's for", CTA stack). Do NOT compress the post to the template's beat count.\n\n${planPinnedTemplate.description ? `${planPinnedTemplate.description}\n\n` : ''}${planPinnedTemplate.scaffold}${coverTitleBlock}`
        : `FORMAT — this post uses the "${planPinnedTemplate.name}" structural template. ALL variants must follow this scaffold exactly:\n\n${planPinnedTemplate.description ? `${planPinnedTemplate.description}\n\n` : ''}${planPinnedTemplate.scaffold}`
    )
  } else {
    // Ad-hoc / fallback: offer all templates and let the model pick.
    const matchingTemplates = ctx.format_templates.filter(
      (t) => t.length_bias === null || t.length_bias === target
    )
    const templates = matchingTemplates.length > 0 ? matchingTemplates : ctx.format_templates
    if (templates.length > 0) {
      parts.push(
        `FORMAT TEMPLATES — pick exactly one per variant. These are STRUCTURAL scaffolds (not topics or words). Different variants should pick different templates when more than one is provided. Each template tells you HOW to lay out the post.\n\n${templates
          // The catalog is 9 formats since 2026-08-19; a 6-slot window would
          // hide whichever ones sit last in a clinic's template order (the
          // newly back-filled ones always do).
          .slice(0, 9)
          .map(
            (t, idx) =>
              `=== Template ${idx + 1}: ${t.name}${
                t.length_bias ? ` [bias: ${t.length_bias}]` : ''
              } ===${t.description ? `\n${t.description}` : ''}\n${t.scaffold}`
          )
          .join('\n\n')}`
      )
    }
  }

  if (excludeHooks && excludeHooks.length) {
    parts.push(
      `DO NOT REUSE THESE HOOKS / OPENINGS (the user asked for a fresh idea — diverge from them):\n${excludeHooks
        .filter((h) => h && h.trim())
        .map((h) => `- "${h.trim()}"`)
        .join('\n')}`
    )
  }

  const insights = ctx.raw_insights.slice(0, 30)
  if (insights.length) {
    parts.push(
      `RAW INSIGHTS (most recent):\n${insights
        .map((i) => `- [${i.type}] ${i.content}`)
        .join('\n')}`
    )
  }

  const trends = ctx.trend_signals.slice(0, 10)
  if (trends.length) {
    parts.push(
      `TREND SIGNALS:\n${trends
        .map(
          (t) =>
            `- ${t.topic}${t.why_relevant ? ` — ${t.why_relevant}` : ''}${
              t.hook_angle ? ` (hook angle: ${t.hook_angle})` : ''
            }`
        )
        .join('\n')}`
    )
  }

  const recent = ctx.content_memory.slice(0, 10)
  if (recent.length) {
    parts.push(
      `RECENT SCRIPTS — DO NOT REPEAT TOPICS OR HOOKS:\n${recent
        .map((c) => `- topic: ${c.topic ?? 'n/a'} | hook: ${c.hook ?? 'n/a'}`)
        .join('\n')}`
    )
  }

  const examples = ctx.few_shot_library.slice(0, 5)
  if (examples.length) {
    parts.push(
      `FEW-SHOT VOICE EXAMPLES — study TONE, RHYTHM, and SENTENCE LENGTH only.\n` +
      `⚠️ NEVER copy medical claims, procedures, treatments, or specific phrases from these examples into a script on a different topic.\n` +
      `${examples
        .map(
          (e, idx) =>
            `--- Voice Example ${idx + 1}${e.topic ? ` (topic: ${e.topic})` : ''} ---\n${e.script_text}${
              e.why_good ? `\n(why it works: ${e.why_good})` : ''
            }`
        )
        .join('\n\n')}`
    )
  }

  if (ctx.recent_picks.length) {
    // Intentionally topic+hook ONLY — full_script is excluded.
    // Including full scripts caused the model to copy medical claims verbatim
    // from unrelated posts (e.g. ED procedures appearing in an SGB/PTSD script).
    parts.push(
      `DOCTOR'S RECENT PICKS — topic/hook patterns that worked (match the ANGLE and HOOK SHAPE only, never copy medical claims or procedures from these):\n${ctx.recent_picks
        .slice(0, 6)
        .map((f) => `- topic: ${f.topic ?? 'n/a'} | hook: ${f.hook ?? 'n/a'}`)
        .join('\n')}`
    )
  }

  if (ctx.recent_rejects.length) {
    parts.push(
      `DOCTOR'S RECENT REJECTS (avoid these angles / hook shapes):\n${ctx.recent_rejects
        .slice(0, 6)
        .map(
          (f) =>
            `- topic: ${f.topic ?? 'n/a'} | hook: ${f.hook ?? 'n/a'}`
        )
        .join('\n')}`
    )
  }

  if (ctx.diff_rules.length) {
    parts.push(
      `MANDATORY DIFF RULES (priority high → low):\n${ctx.diff_rules
        .map(
          (r) =>
            `- ${r.rule}${r.example_before ? `\n  before: ${r.example_before}` : ''}${
              r.example_after ? `\n  after: ${r.example_after}` : ''
            }`
        )
        .join('\n')}`
    )
  }

  if (feedback && feedback.trim()) {
    parts.push(
      `CRITIC FEEDBACK FROM PREVIOUS ROUND:\n${feedback.trim()}\n\nAddress every point above. Keep variants that were already strong; rewrite the weak ones.`
    )
  }

  return parts.join('\n\n')
}

export interface RunWriterParams {
  context: SharedContext
  feedback?: string
  topicHint?: string
  ctaHint?: string | null
  variantCount?: number
  lengthTarget?: ScriptLengthTarget
  refineFrom?: {
    topic: string | null
    hook: string | null
    script: string
    note?: string
  }
  // Studio: pin a single reference-video format and (optionally) ask for
  // role-assigned output. Leaves the legacy template-choice path intact.
  pinnedFormat?: PinnedFormat
  // Studio "regenerate": hooks to diverge from on this pass.
  excludeHooks?: string[]
  // Studio "tweak": a short free-text steer from the user ("make it
  // shorter", "more about knees"). Applied on top of the pinned format.
  studioSteer?: string | null
  // Post carousel pipeline (HANDOFF-POSTS.md §17.3 + §18). When true,
  // appends the HWC content-plan structural template + compliance
  // baseline + acute-trigger rules to the system prompt. Used by the
  // shared lib/posts/pipeline.ts and the cron entry.
  postCarouselMode?: boolean
  // Structured plan context (90% path). When present, the Writer is
  // locked to the week's pillar/theme/keyword. Null = ad-hoc (10% path).
  planContext?: PlanContext | null
  // Per-post PubMed studies (plan (b), 2026-07-30). Real current evidence
  // retrieved for THIS topic; injected as a prompt block so the "data"
  // slide cites live studies, not the model's static memory. Empty when
  // retrieval found nothing → falls back to the static VERIFIED FACTS.
  studiesBlock?: string
  // Lines this clinic already published, as a do-not-reuse list
  // (lib/posts/said-before.ts). Goes in the USER content, never the cached
  // system block. Empty/absent = no repetition guard for this run.
  saidBeforeBlock?: string
  // The format button (Igor 2026-08-19). Wins over the plan's assigned
  // format, loses to a Studio pinnedFormat. Must name a template the clinic
  // has in script_templates — otherwise it degrades to "Writer picks".
  formatOverride?: string | null
}

export async function runWriter(params: RunWriterParams): Promise<WriterOutput> {
  const target: ScriptLengthTarget = params.lengthTarget ?? 'short'
  const brief = buildContextBrief(
    params.context,
    target,
    params.feedback,
    params.pinnedFormat,
    params.excludeHooks,
    params.planContext,
    params.postCarouselMode,
    params.formatOverride
  )
  const count = Math.max(1, Math.min(3, params.variantCount ?? 3))
  const roleMode = Boolean(params.pinnedFormat?.rolePlan?.speakers?.length)

  // Resolve niche profile for this clinic. Controls CTA mode, compliance
  // facts block, persona, and whether keyword is injected.
  const profile = getNicheProfile(params.context.clinic_profile.niche)
  const clinicName = params.context.clinic_profile.name
  const socialHandle = params.context.clinic_profile.social_handle ?? null

  // Build topic/plan section. planContext (90% path) injects the full
  // editorial calendar context — week, theme, pillar, keyword. Without it
  // (ad-hoc 10% path) we fall back to the plain topicHint string.
  const topicSection = (() => {
    if (params.planContext) {
      const pc = params.planContext
      const lines = [
        `\n\nCONTENT PLAN CONTEXT — this post is part of the editorial schedule:`,
        `- Week ${pc.week_number} · Theme: "${pc.theme}"`,
        `- Pillar: "${pc.pillar}" — every variant MUST stay inside this pillar`,
        `- Topic (fixed for all variants): "${pc.topic}"`,
      ]
      // Only inject ManyChat keyword for manychat niche. Booking niches
      // have no comment-keyword CTA mechanic.
      if (pc.keyword && profile.ctaMode === 'manychat') {
        lines.push(`- ManyChat KEYWORD (BINDING): "${pc.keyword}" — the Comment line in EVERY variant must use this exact word. Never substitute, translate, or invent another keyword.`)
      }
      lines.push(`\nWrite ALL variants on the topic above. Pick distinct angles, hooks, or format templates, but the topic and pillar are fixed.\n`)
      return lines.join('\n')
    }
    if (params.topicHint) {
      return `\n\nTOPIC — write ALL variants on this exact topic. Pick distinct angles, hooks, or format templates, but the underlying topic is fixed:\n"${params.topicHint.trim()}"\n`
    }
    return ''
  })()

  const ctaSection = params.ctaHint
    ? `\n\nCTA TEMPLATE — the call-to-action block (step 4) of every variant must follow this pattern. Replace any {placeholders} with concrete text that fits the script:\n"${params.ctaHint.trim()}"\n`
    : ''

  const refineSection = params.refineFrom
    ? `\n\nPREVIOUS ATTEMPT (refine — do NOT restart from scratch):\ntopic: ${
        params.refineFrom.topic ?? 'n/a'
      }\nhook: ${params.refineFrom.hook ?? 'n/a'}\nscript:\n${params.refineFrom.script.trim()}${
        params.refineFrom.note && params.refineFrom.note.trim().length > 0
          ? `\n\nDOCTOR FEEDBACK ON PREVIOUS ATTEMPT:\n"${params.refineFrom.note.trim()}"`
          : '\n\nThe doctor said the idea is right but the execution is not yet there. Keep the topic and the underlying angle.'
      }\n\nKeep what worked, fix what was weak. Tighten the hook if it was generic. Sharpen the science block. Make the clinic-approach block more concrete. Keep the same length spec.`
    : ''

  const formatInstruction = params.pinnedFormat
    ? `follow the LENGTH SPEC and the single pinned FORMAT (set template_name to "${params.pinnedFormat.templateName}")${
        roleMode ? ' and include role_blocks using only the allowed speakers' : ''
      }`
    : 'follow the LENGTH SPEC and pick one FORMAT TEMPLATE (set template_name accordingly)'

  const steerSection =
    params.studioSteer && params.studioSteer.trim()
      ? `\n\nUSER TWEAK — adjust the idea to honour this request (keep the same pinned format):\n"${params.studioSteer.trim()}"\n`
      : ''

  const studiesSection =
    params.studiesBlock && params.studiesBlock.trim() ? params.studiesBlock : ''

  const saidBeforeSection =
    params.saidBeforeBlock && params.saidBeforeBlock.trim()
      ? params.saidBeforeBlock
      : ''

  const userContent = `${brief}${topicSection}${studiesSection}${saidBeforeSection}${ctaSection}${refineSection}${steerSection}\n\nGenerate exactly ${count} script variant${count === 1 ? '' : 's'} now. Each variant must ${formatInstruction}. Return only the JSON object.`

  const systemPrompt =
    buildSystemBase(profile) +
    (params.postCarouselMode ? buildSystemPosts(profile, clinicName, socialHandle) : '') +
    (roleMode ? SYSTEM_PROMPT_ROLES : '')

  // Back on callAgentJSON. tool_use forced thinking/effort to be
  // incompatible with tool_choice and burned through Sonnet's quality
  // lever on the long post-carousel prompt. The repair heuristic in
  // parseJSONBlock (v2.1) handles the unescaped-quote class of bug
  // that tool_use was supposed to eliminate.
  const out = await callAgentJSON<WriterOutput>({
    model: MODEL_DEFAULT,
    systemPrompt,
    userContent,
    maxTokens: 16384,
    // effort MUST stay low here: medium+ extended thinking consumes the
    // whole 16384 output budget on the long carousel prompt and the call
    // dies with stop_reason=max_tokens before any text (proven again
    // 2026-07-24). Depth comes from the prompt's hard requirements.
    effort: 'low',
    cacheSystem: true,
  })

  // In role mode, make full_script (= variant.script) the canonical join
  // of role_blocks so the two can never disagree downstream.
  if (roleMode && out?.variants) {
    for (const v of out.variants) {
      if (v.role_blocks && v.role_blocks.length) {
        v.script = joinRoleBlocks(v.role_blocks)
      }
    }
  }

  return out
}
