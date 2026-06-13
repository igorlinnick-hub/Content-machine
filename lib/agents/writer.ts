import type {
  SharedContext,
  WriterOutput,
  ScriptLengthTarget,
  RolePlan,
  RoleBlock,
} from '@/types'
import type { ArsenalBeat } from '@/lib/arsenal/store'
import { MODEL_DEFAULT, callAgentTool } from './base'

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
    .map((b) => `${b.speaker}: ${b.text}${b.direction ? ` (${b.direction})` : ''}`)
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

const SYSTEM_PROMPT_BASE = `You write scripts for a regenerative medicine doctor speaking to camera. The audience is curious ADULT PATIENTS — people considering a treatment or trying to understand what's happening with their body. NOT colleagues. NOT other doctors. NOT a peer-reviewed audience.

Voice: a smart, calm doctor explaining things plainly to someone in their chair. Plain English. Short sentences. Concrete everyday comparisons. No medical jargon unless it is immediately unpacked in lay terms (e.g. "your platelets — the part of your blood that helps healing"). Banned phrases: "as a clinician", "in our practice we observe", "the literature suggests", "peer-to-peer", "from a clinical standpoint". Allowed registers: "here's what most people miss", "if you're considering this", "what this means for you", "what to look out for", "why this matters". Do NOT copy-paste a generic "educational / professional / conversational" register. The exact tone is inferred from the FEW-SHOT EXAMPLES and the DOCTOR'S RECENT PICKS.

HARD RULES:
- No medical promises ("will cure", "guaranteed", "100%", "always works").
- Only facts with scientific grounding. If you cannot back something, do not write it.
- Follow the LENGTH SPEC and the FORMAT TEMPLATE you choose. Both are mandatory.

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

// Appended to the base system prompt for the POST CAROUSEL pipeline
// (HANDOFF-POSTS.md §17.3 + §18). NOT used for video / arsenal flows.
// Toggled via RunWriterParams.postCarouselMode.
//
// Locks the writer to:
//   • the HWC content-plan structural arc (cover → mechanism → analogy
//     → evidence → application → CTA stack)
//   • compliance baseline from docs/content-plan-2026-06.md §4
//   • mental-health-acute stripped template when the topic matches
//     §18.1 triggers
//   • Sources go to a separate metadata block, NEVER to the caption
const SYSTEM_PROMPT_POSTS = `

POST CAROUSEL MODE (active for this request):
You are writing for Hawaii Wellness Clinic's Instagram carousel pipeline. Every variant MUST follow the universal structural arc below. This is non-negotiable — the editorial plan in docs/content-plan-2026-06.md §2 ships only carousels in this shape.

SLIDE ARC (in order):
  Slide 1   Cover                  — title (mixed case) + hook ending with "Swipe →"
  Slide 2   Mechanism / Real cause — heading + intro + 3 bullets + close
  Slide 3   Gap slide (optional)   — "why standard care misses this" — include WHEN the post explains an insurance / 15-min-visit / equipment-cost reason standard medicine skips the better option; SKIP for how-to / multi-pathway / acute topics
  Slide 4   Think of it this way   — sticky analogy in plain prose, no bullets. e.g. "X is like Y — [the punchline]". SKIP for mental-health-acute topics (see below).
  Slide 5   What the data shows    — bullets with sourced facts (FDA dates, trial names, %)
  Slide 6   Who it's for           — bullets + close
  Slide 7   Session / protocol     — optional
  Slide 8   Why it's underused     — optional
  Final     CTA stack              — Follow + Comment "<KEYWORD>" + Book

CTA STACK FORMAT (always 3 lines unless mental-health-acute):
  Follow → @hawaiiwellness for science-backed wellness, no hype.
  Comment → "<KEYWORD>" and we'll <what we send>.
  Book → tap the link in bio or DM us to start an evaluation.

KEYWORD is a single ALL-CAPS word from the post topic — see lib/seeds/cta-keywords.ts for the deterministic 24-post map. If the topic matches a plan post, use that exact keyword.

MENTAL-HEALTH-ACUTE STRIPPED TEMPLATE:
When topic or hook contains any of: "suicid", "self-harm", "self harm", "acute ideation", "active ideation", "988", "lifeline", "crisis intervention" — switch to the stripped template:
  • NO "Think of it this way" analogy slide
  • CTA = Comment "<KEYWORD>" only + crisis line
  • Caption MUST end with the 988 crisis line
  • Tone stays clinical and supportive. NEVER "system failed you" / "you deserve better" framing.

COMPLIANCE BASELINE (HARD — every variant must pass):
  • NEVER claim a therapy "treats / cures / reverses / regenerates / restores" anything. Use "supports", "may help", "studies report", "pilot data shows".
  • NEVER state "FDA-approved" or "FDA-cleared" unless literally true for that exact product. Verified dates in docs/content-plan-2026-06.md §4.2 — match those exactly:
      TMS — depression 2008, OCD 2018, smoking 2020, anxious depression 2021 (NOT 2020)
      Spravato — TRD Mar 2019, MDD-w-suicidal-ideation 2020, monotherapy Jan 2025
      SELECT trial — 17,604 adults with ESTABLISHED cardiovascular disease (do not drop "established")
      Retatrutide — investigational, NOT FDA-approved (Phase 2 NEJM 2023; Phase 3 TRIUMPH Dec 2025)
      Peptides (BPC-157, TB-500, CJC-1295/Ipamorelin) — NOT FDA-approved
      Exosomes — NEVER offer as a service (FDA: no approved exosome products)
  • ALWAYS label evidence stage: "Phase 2", "pilot studies", "preclinical", "investigational, not FDA-approved".
  • ALWAYS produce a sources array with each non-trivial factual claim cited. Sources go in a separate "sources" field — NEVER inside the script or caption.
  • For Mental Health bucket captions, ALWAYS end the caption with: "If you or someone you know is struggling, call or text 988 — the Suicide & Crisis Lifeline."

OUTPUT SHAPE (POST CAROUSEL):
The "script" field of each variant is the full carousel rendered as readable text — cover line + each numbered slide + CTA stack. The compliance gate reads this; downstream the splitter parses it into the slide_sets row.

Use the canonical examples in docs/content-plan-2026-06.md §5 (posts 01 Ketamine, 07 Painkillers, 11 Semaglutide, 18 ED) as gold-standard tone references when relevant — these are source-checked and pass compliance v2.1.
`

// Appended to the base system prompt only when a pinned format requests
// role assignment (Studio). Adds role_blocks to the schema. The model
// returns role_blocks; the server derives full_script by joining them.
const SYSTEM_PROMPT_ROLES = `

ROLE MODE (active for this request):
This is a SHOOT BRIEF for the clinic's own staff — NOT professional actors — to film, not a solo monologue. Make it simple and doable.

SETTING (hard): everything is filmed INSIDE THE CLINIC (treatment room, hallway, reception, equipment). Never outdoors. Never reference a location the clinic doesn't have.
ADAPT, don't copy: take the reference video's FORMAT (its structure / pacing / hook style) and rebuild it as something THIS clinic can actually shoot for ITS niche and services. Keep it concrete and easy.

Every variant MUST add two fields:

1. "summary_steps" — 3 to 5 short, plain-English steps telling the team WHAT to film, in order (e.g. "Doctor stands by the treatment table, phone vertical", "Name two options on screen, pick one with a one-line reason", "Do 4 rounds, end with the overall pick"). Simple enough for a non-actor to follow.

2. "role_blocks" — the script broken into who-says-what on camera. Use ONLY the allowed speakers listed in the FORMAT block. Speakers: Doctor (on camera), Operator (the person behind the camera — a spoken line OR just a "direction" action like "drop two labelled images on screen"), Patient/Assistant only if the format truly needs a second person. Each block is one beat; add a short "direction" only when a physical action matters; otherwise omit it.

The "script" field must be the plain spoken text of the blocks in order (no speaker labels). All output in ENGLISH.

Each variant's JSON gains:
  "summary_steps": ["...", "...", "..."],
  "role_blocks": [
    { "speaker": "Doctor", "text": "...", "direction": "optional action" },
    { "speaker": "Operator", "text": "", "direction": "drop two labelled images on screen" }
  ]`

function buildLengthSpecBlock(target: ScriptLengthTarget): string {
  const spec = LENGTH_SPECS[target]
  return `LENGTH SPEC — TARGET: ${spec.label.toUpperCase()} (${
    spec.label === 'short' ? '~90s boost cut' : '~2.5min organic'
  })
- Word count: ${spec.word_min}-${spec.word_max} words. Count before you finish.
- Estimated seconds: ${spec.seconds_min}-${spec.seconds_max}.
- Beat budget (in order):
  1. Hook — ~${spec.hookWords} words. Concrete fact or question, not a generic opening.
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
  excludeHooks?: string[]
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

  if (pinnedFormat) {
    // Studio: one format pinned to a reference video. Skip the
    // pick-one-of-N templates block entirely.
    parts.push(buildPinnedFormatBlock(pinnedFormat))
  } else {
    // Format templates — bias toward those that match the requested length budget.
    const matchingTemplates = ctx.format_templates.filter(
      (t) => t.length_bias === null || t.length_bias === target
    )
    const templates = matchingTemplates.length > 0 ? matchingTemplates : ctx.format_templates
    if (templates.length > 0) {
      parts.push(
        `FORMAT TEMPLATES — pick exactly one per variant. These are STRUCTURAL scaffolds (not topics or words). Different variants should pick different templates when more than one is provided. Each template tells you HOW to lay out the post.\n\n${templates
          .slice(0, 6)
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
      `FEW-SHOT VOICE EXAMPLES (match this voice — do NOT copy structure):\n${examples
        .map(
          (e, idx) =>
            `--- Example ${idx + 1}${e.topic ? ` (topic: ${e.topic})` : ''} ---\n${e.script_text}${
              e.why_good ? `\n(why it works: ${e.why_good})` : ''
            }`
        )
        .join('\n\n')}`
    )
  }

  if (ctx.recent_picks.length) {
    parts.push(
      `DOCTOR'S RECENT PICKS (lean toward these patterns):\n${ctx.recent_picks
        .slice(0, 6)
        .map(
          (f, idx) =>
            `--- Pick ${idx + 1} (topic: ${f.topic ?? 'n/a'}) ---\nhook: ${f.hook ?? 'n/a'}\n${f.full_script}`
        )
        .join('\n\n')}`
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
  // Post carousel pipeline (HANDOFF-POSTS.md §17.3 + §18). When true,
  // appends the HWC content-plan structural template + compliance
  // baseline + acute-trigger rules to the system prompt. Used by the
  // shared lib/posts/pipeline.ts and the cron entry.
  postCarouselMode?: boolean
}

export async function runWriter(params: RunWriterParams): Promise<WriterOutput> {
  const target: ScriptLengthTarget = params.lengthTarget ?? 'short'
  const brief = buildContextBrief(
    params.context,
    target,
    params.feedback,
    params.pinnedFormat,
    params.excludeHooks
  )
  const count = Math.max(1, Math.min(3, params.variantCount ?? 3))
  const roleMode = Boolean(params.pinnedFormat?.rolePlan?.speakers?.length)

  const topicSection = params.topicHint
    ? `\n\nTOPIC FROM THE CONTENT PLAN — write ALL variants on this exact topic. Pick distinct angles, hooks, or format templates, but the underlying topic is fixed:\n"${params.topicHint.trim()}"\n`
    : ''

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

  const userContent = `${brief}${topicSection}${ctaSection}${refineSection}\n\nGenerate exactly ${count} script variant${count === 1 ? '' : 's'} now. Each variant must ${formatInstruction}. Return only the JSON object.`

  const systemPrompt =
    SYSTEM_PROMPT_BASE +
    (params.postCarouselMode ? SYSTEM_PROMPT_POSTS : '') +
    (roleMode ? SYSTEM_PROMPT_ROLES : '')

  // Switched from callAgentJSON to callAgentTool — Anthropic guarantees
  // the tool input parses cleanly against the schema, killing the entire
  // "unescaped double quote inside script field" class of bug we hit
  // repeatedly with Sonnet on the long post-carousel prompt. No more
  // JSON.parse on free-form prose.
  const out = await callAgentTool<WriterOutput>({
    model: MODEL_DEFAULT,
    systemPrompt,
    userContent,
    maxTokens: 16384,
    effort: 'low',
    cacheSystem: true,
    toolName: 'emit_script_variants',
    toolDescription:
      'Emit the requested script variants. Strings (especially `script`) may contain any prose — quotes, apostrophes, em-dashes, newlines — the schema handles escaping.',
    inputSchema: {
      type: 'object',
      required: ['variants'],
      properties: {
        variants: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'id',
              'topic',
              'hook',
              'script',
              'word_count',
              'estimated_seconds',
            ],
            properties: {
              id: { type: 'string' },
              topic: { type: 'string' },
              hook: { type: 'string' },
              script: {
                type: 'string',
                description: 'Full script. Free-form prose; quotes/newlines fine.',
              },
              word_count: { type: 'integer' },
              estimated_seconds: { type: 'integer' },
              template_name: { type: 'string' },
              summary_steps: {
                type: 'array',
                items: { type: 'string' },
              },
              role_blocks: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['speaker', 'text'],
                  properties: {
                    speaker: { type: 'string' },
                    text: { type: 'string' },
                    direction: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
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
