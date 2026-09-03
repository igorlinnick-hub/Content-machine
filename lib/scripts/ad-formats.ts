// The AD format catalog — the paid-promotion counterpart to `lib/posts/formats.ts`.
//
// POST_FORMATS answers "how do we SAY this week's topic" for organic carousels
// and organic video scripts. This registry answers a different question: how do
// we shape a 25-45 second spot that runs as an AD, where the viewer did not
// follow us, did not ask, and is one thumb-flick from gone.
//
// Deliberately NOT merged into POST_FORMATS (Igor 2026-08-20):
//   • the planner must never schedule an ad into the weekly content plan —
//     ads are bought, not planned, so they stay out of that registry;
//   • ads run at the 'ad' length target (~90-140 words), roughly half of
//     'short' (200-220), and the shared registry has no way to say that;
//   • an ad has no carousel form at all, so `carouselArc` / `coverTitle`
//     would sit permanently null.
//
// Derived from a teardown of four high-performing doctor ad spots
// (@benimedia, dental / oral-maxillofacial, Aug 2026 — 25-46s, 77-131 words,
// 2.8-3.5 words/sec). The full transcript analysis is in docs/ADS-CRAFT.md.
// Change a rule HERE and it reaches the Writer, the Critic length band, and
// the ad-format buttons in the dashboard.

export interface AdFormat {
  /** Canonical name — stored on the script row as template_used. */
  name: string
  /** Short button text for the UI. */
  label: string
  /** One line the marketer reads on hover: when to reach for this ad. */
  hint: string
  /** Longer line handed to the Writer as the format's intent. */
  description: string
  /**
   * The shape of the FIRST SPOKEN LINE. Every reference ad opened on a flat
   * declarative carrying a stance — never a question, never a statistic,
   * never a "3 things" promise. Each format opens on a different KIND of
   * declarative, and that is most of what makes the four feel distinct.
   */
  hookShape: string
  /** The beats, in order. */
  scaffold: string
  /** What specifically ruins THIS format. Handed to the Writer verbatim. */
  failureModes: string
}

/**
 * Rules every ad obeys regardless of format — the invariants that held across
 * all four reference spots. Injected once, above the chosen format's scaffold.
 */
export const AD_CRAFT_RULES = `AD CRAFT — BINDING FOR EVERY AD SCRIPT (these override nothing in the compliance wall; they sit on top of it):

1. NO ENGAGEMENT BAIT IN THE SPOKEN LINES. Not one word of it. No "comment below", no "watch till the end", no "save this", no "link in bio", no "swipe up", no "let me know what you think". The reference ads contain ZERO. The call-to-action is placed by the media buyer in the caption and the ad unit — the doctor's voice never asks for a tap. A script that asks for engagement is a failed variant.

2. THE HOOK IS A FLAT DECLARATIVE WITH A STANCE. Never a question ("Did you know…", "Are you struggling with…"). Never an opening statistic. Never a count-promise ("Three things about…"). Never a command ("Stop doing X"). State something and mean it, in one sentence, and let the sentence be the whole first beat.

3. NAME THE PROCEDURE BY ITS REAL CLINICAL NAME IN THE FIRST SENTENCE — then translate it into ordinary words immediately, in the same breath or the next sentence. No coyness ("there's a procedure that…", "this one treatment"). The viewer who needs it is searching for the real word; the viewer who doesn't gets the translation.

4. SELF-RECOGNITION, NOT PAIN-AGITATION. Where the script tells the viewer this is for them, it does it with a neutral list of OBSERVABLE FACTS OF DAILY LIFE — what they can see or feel this week — never by telling them how bad they must feel. Write "dentures that slip that you have to take out", "makes eating and laughing feel like a chore", "where structure has been lost to grinding". Do not write "you're embarrassed to smile", "you've suffered long enough", "imagine the confidence". The viewer supplies the emotion; the script supplies the facts.

5. ONE CONCRETE SPECIFICATION, AND ONLY ONE. Exactly one detail in the whole script that proves real competence — a count, a material property, a duration, a training fact ("as few as four strategically placed implants", "colour fast for years", "my residency was hospital-based"). One lands as expertise; three land as a brochure. Pick the single most load-bearing one. It must still obey the FACT-ACCURACY RULES — no unsourced percentages, no approval years.

6. MECHANISM IS ALWAYS PRESENT AND ALWAYS SHORT. One or two sentences on what physically happens, ending on the part that is genuinely remarkable — the turn that makes a viewer stop scrolling: "the material integrates with your body's own biology over time and what grows back is real living bone"; "aligners move the teeth rather than reshaping them". For an ad, this mechanism sentence IS the science beat — a cited study is not required and usually does not fit at this length. Say only what is true.

7. THE RESULT IS IN ORDINARY VERBS, NEVER IN ADJECTIVES OR NOUNS. Write "you brush them, you eat with them, you forget they're not your original teeth." Do not write "confidence, freedom, and a smile you love." Abstract-noun payoffs are the single clearest tell of ad copy. If a payoff line contains "confidence", "freedom", "journey", "quality of life", or "transform", rewrite it as something the person physically does on a Tuesday.

8. ONE ANAPHORA, ONE TIME. Each script carries exactly ONE repeated sentence-stem that gives it rhythm and gives the editor something to cut captions against — "If you're… or if you're… and if it…", "Where enamel has worn, where teeth have fractured, where structure has been lost…", "Bone that can hold…, bone that can anchor…". Use it once, in the list beat. Two anaphoras in a 100-word script reads as verse.

9. THERE IS A LIST BEAT. Every ad contains one rapid-fire enumeration — symptoms, causes, cases, or procedures — delivered without elaborating each item. This is the beat the editor turns into the b-roll montage, and an ad without it has nothing to cut to.

10. PRONOUN DISCIPLINE. "I" for the doctor's stance and training. "We" for what the clinic can do. "You / your" for the viewer's body and life. Never "one" or "patients" when the viewer is meant.

11. NO CLOSE, OR A QUIET ONE. Three of the four reference ads simply stop on the last useful sentence. If the script does close, it closes on possibility in the doctor's own plain voice ("There's always a way forward.") — never on an offer, a price, an urgency line, or a booking instruction.`

export const AD_FORMATS: AdFormat[] = [
  {
    name: 'Procedure offer',
    label: 'Offer',
    hint: 'This exists, here is exactly who it is for, here is what an ordinary day looks like after.',
    description:
      'The workhorse ad: name a procedure most of the local audience does not know is available, qualify the viewer with observable daily facts, then show the after in plain verbs. Reach for it when the clinic has a service that solves a visible, chronic, daily annoyance.',
    hookShape:
      'A VERDICT — the doctor rates the procedure out loud in one sentence, using its real name. "Full arch restoration is one of the most life-changing procedures in dentistry." The stance is the hook; do not soften it into "can be" or "may be".',
    scaffold: `[Verdict — one sentence, real clinical name, the doctor's own rating of it. No hedge, no teaser.]

[Why the doctor is saying this — the motive, plus WHERE it is available. One sentence. This is where the local geography goes ("I want more people in <area> to know that it exists and that it's available right here"), and it is the only place the clinic sells itself. If no service area is supplied, drop the geography rather than inventing one.]

[Who it's for — the LIST BEAT and the script's single anaphora. Two to four "if you're… / or if you're… / and if it…" clauses, each a fact the viewer can observe about their own week. The last clause is the one that costs them socially ("makes eating and laughing feel like a chore"), stated flatly. Then close the beat on the promise in five words or fewer: "there is a permanent solution."]

[How it works — one or two sentences of mechanism carrying the script's ONE specification, ideally a count. "Using as few as four strategically placed implants, we can anchor a full fixed arch of teeth that you never have to remove."]

[The after — two or three ordinary verbs, present tense, no adjectives. "You brush them, you eat with them, you even forget they're not your original teeth." This is the last line. Stop here.]`,
    failureModes: `Kills this format: turning the qualifier list into a pity list ("you've stopped going out", "you hide your smile"); stacking a second and third specification after the count; ending on a benefit noun instead of a verb; adding a booking line the reference ads do not have. If the clinic's service area is unknown, the geography sentence is CUT — never guessed.`,
  },
  {
    name: 'Honest gatekeeper',
    label: 'Gatekeeper',
    hint: 'When this is the right answer — and, out loud, when you probably do not need it.',
    description:
      'The trust ad. The doctor draws the line where the procedure genuinely belongs, then tells a large share of the audience they may not need it and names the cheaper alternative. It sells by disqualifying. For a regulated clinic this is also the safest ad shape there is: the persuasive move is a de-sell, so there is almost nothing for a compliance gate to catch.',
    hookShape:
      'IN MEDIAS RES — open mid-argument, as if the viewer joined a sentence already running. "That is no longer what people are looking for." The missing antecedent is deliberate: the viewer stays to find out what "that" was. Do NOT set it up first; the setup is what the second sentence delivers.',
    scaffold: `[In medias res — one short sentence that lands mid-thought. It must be intelligible as English but incomplete as an idea.]

[What changed — the shift that makes the old default wrong now, described through PEOPLE rather than through the market. "The faces that set the standard now are people who are more open about wearing aligners, who talk about protecting their enamel, and whose teeth are still their own." This is one of the two places the anaphora can live.]

[The correction against overcorrection — one flat sentence protecting the procedure from the swing you just described: "This has not made veneers obsolete."]

[When it IS the answer — the LIST BEAT. Three "where…" clauses naming the real indications as physical states, then the verdict in three words ("Veneers fix that."), then the script's ONE specification as a short run of properties ("Durable, stable, colour fast for years."), then the boundary: "In those cases, there are no substitutes."]

[The de-sell — the beat that makes this format work, and it must be unmistakable: "For many people who inquire about <procedure>, the answer is they may not need them." Name the condition under which they don't ("if your enamel is healthy and your concern is position and colour").]

[The alternative, named — the cheaper or less invasive route said plainly, with what it spares them ("…will often deliver the result without touching tooth structure"). Then one line of mechanism contrast that shows the doctor is choosing on physics, not price: "Aligners move the teeth rather than reshaping them." Stop here — no close.]`,
    failureModes: `Kills this format: a de-sell that is really a sell ("you may not need them — but most of my patients do"); naming an alternative the clinic does not actually offer or refer for; hedging the boundary line so it stops being a boundary; adding a CTA, which converts an act of honesty back into a pitch. The de-sell must cost the clinic something real, or the ad has no engine.`,
  },
  {
    name: 'Scope and credentials',
    label: 'Credentials',
    hint: 'What this specialty actually covers, and what separates the doctor from the tier below.',
    description:
      'The shortest ad shape and the one for cold traffic that does not know the specialty exists. It answers "what do you even do" and "why you rather than the generalist" — nothing else. Reach for it as a first-touch ad, or when the clinic keeps getting the wrong enquiries.',
    hookShape:
      'A KNOWLEDGE GAP, stated as fact about the audience — not as a question to them. "Most people don\'t know what oral and maxillofacial surgery covers until they need it." The "until they need it" clause is what makes it an ad instead of a lecture: it tells the viewer this becomes urgent later.',
    scaffold: `[The gap — one sentence naming the specialty in full and noting that people learn it only when they need it.]

[Permission to simplify — a short self-directive that resets the register: "So let me break it down simply." This is the ONE place a meta-sentence is allowed in any ad format, because it is a promise the very next sentence keeps.]

[Identity in one line — "I'm a surgeon who specializes in the mouth, jaw, and face." Body parts and plain nouns, no titles, no institutions.]

[Scope — the LIST BEAT, and the fastest one in the catalog: five to seven services named and NOT explained, comma-separated, no elaboration on any of them. "Dental implants, tooth extractions, wisdom teeth, biopsies of oral lesions, facial trauma, corrective jaw surgery." The speed is the point — it demonstrates range in four seconds.]

[What separates the tier — the script's ONE specification, framed as the reason the list above is safe in these hands, and tied to a decision rather than a credential wall: "…because my residency was hospital-based, what separates this from general dental care is the depth of medical and surgical training behind every decision I make." Stop here.]`,
    failureModes: `Kills this format: explaining any item in the scope list (it doubles the runtime and destroys the effect); a credential beat that lists letters, schools, or years instead of naming what the training changes about a decision; disparaging general practitioners by name or implication — the line separates tiers of training, it does not insult the tier below. This format carries no patient-qualifier beat and no result beat; adding them makes it a different ad.`,
  },
  {
    name: 'Defuse the fear',
    label: 'Defuse',
    hint: 'The procedure whose NAME is the obstacle — redefine the word, then show what grows back.',
    description:
      'For procedures people decline because the term sounds violent or frightening (grafting, extraction, surgery, injection). The ad spends its first line taking the fear out of the word by redefining what the procedure IS, then earns trust with biology. The only format in the catalog that closes out loud.',
    hookShape:
      'A REFRAME — concede the feeling, then replace the category in the same sentence. "Bone grafting may sound intimidating, but what it actually is is preparation." Concede briefly and move on; do not dwell on the fear, and never amplify it first in order to relieve it.',
    scaffold: `[Reframe — "<procedure> may sound <the honest feeling>, but what it actually is is <ordinary category>." One sentence. Then one short line turning that category into a plain metaphor: "It's building the foundation for what makes everything else possible."]

[Why it's needed — the LIST BEAT, worn light: the causes named in a single breath ("when bone is lost due to tooth loss, infection, gum disease, or even trauma"), closed by what the clinic does about it in three words ("we replace it").]

[The biology — the beat this format is built on, and where its ONE specification lives. Two sentences: what the material does, then what the body does in response, ending on the genuinely remarkable fact stated plainly. "The material we use integrates with your body's own biology over time, and what grows back is real living bone." Never oversell it — the fact is enough.]

[What that makes possible — the script's anaphora, as a short consequence ladder off the previous sentence: "Bone that can hold an implant. Bone that can anchor a restoration for years."]

[Both sizes of case — one "whether… or…" sentence covering the small routine version and the large one, so no viewer rules themselves out, closed by the clinic's capability in one clause ("we have the surgical training and the technology to do it right").]

[The quiet close — the only close in the catalog. One sentence naming the thing not worth losing, and one of possibility. "Don't let bone loss be the reason you live without the smile you deserve. There's always a way forward." Nothing after it — no offer, no urgency, no booking line.]`,
    failureModes: `Kills this format: amplifying the fear before defusing it (naming complications, pain, or what happens if they wait); a biology beat that reaches past what is true — "real living bone" works because it is literally accurate, and an invented equivalent is both a lie and a compliance violation; a close that turns the possibility line into an offer. The reframe must swap the CATEGORY of the thing ("it's preparation"), not merely soften the adjective ("it's not that bad").`,
  },
]

export const AD_FORMAT_NAMES = AD_FORMATS.map((f) => f.name)

export function getAdFormat(name: string | null | undefined): AdFormat | null {
  if (!name) return null
  const needle = name.trim().toLowerCase()
  return AD_FORMATS.find((f) => f.name.toLowerCase() === needle) ?? null
}

export function isKnownAdFormat(name: string | null | undefined): boolean {
  return getAdFormat(name) !== null
}

/** What the buttons render — no scaffolds, so this can cross to the client. */
export const AD_FORMAT_CHOICES: Array<Pick<AdFormat, 'name' | 'label' | 'hint'>> =
  AD_FORMATS.map(({ name, label, hint }) => ({ name, label, hint }))

/** The full block handed to the Writer when an ad format is selected. */
export function buildAdFormatBlock(format: AdFormat): string {
  return `${AD_CRAFT_RULES}

AD FORMAT — every variant is written as "${format.name}". This format OWNS THE STRUCTURE: follow the beats below in order, and ignore the generic beat budget in the LENGTH SPEC (hook / science / approach / CTA) — the beats here replace it. One beat may be one sentence; that is normal at this length.

${format.description}

HOOK SHAPE (binding — the first spoken line): ${format.hookShape}

BEATS:
${format.scaffold}

${format.failureModes}

Every variant sets "template_name" to exactly "${format.name}". All variants use THIS format — make them different by choosing a different service, a different qualifier set and a different specification, never by drifting into another format's shape.`
}
