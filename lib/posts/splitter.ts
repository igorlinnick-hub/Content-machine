import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'
import type {
  PostPlanBodySlide,
  PostPlanCover,
  PostPlanCta,
  PostPlanPhotoBrief,
  PostPlanSource,
} from '@/types'
import {
  suggestCtaKeyword,
  isMentalHealthAcute,
  resolveCtaKeyword,
} from '@/lib/seeds/cta-keywords'
import { generatePhotoBriefs } from './photo-brief'
import type { CtaMode } from '@/lib/niche/profiles'

// PostPlan splitter (HANDOFF-POSTS.md §15). Owns its own Haiku call —
// does not import lib/visual/slides.ts which emits the LEGACY
// {chip,text,subtext} shape. This produces the modern shape with
// {n, kind, heading, intro, bullets[], close} per slide so the
// downstream consumers (Canva-bot, future renderer) read structured
// data, not parseable prose.
//
// The writer (postCarouselMode) emits a structured carousel as prose;
// this splitter converts that prose into the canonical PostPlan slide
// array. Cover + CTA come back as separate objects so the route writes
// them into their own DB columns / payload fields.

const SYSTEM_PROMPT = `You convert a finished clinic carousel SCRIPT into the canonical PostPlan JSON shape. The script you receive was already written following the structural arc — your job is to PARSE it into structured slide data, NOT rewrite it.

Slide arc (in order):
  1. Cover               — title + hook (a contrast/question second line may follow the claim)
  2. Mechanism / Real cause — heading + intro + 2-4 bullets + close
  3. Optional gap slide  — heading + intro + close (no bullets)
  4. Analogy             — prose body in 'close' field, no bullets. Keep the script's OWN heading verbatim; it is deliberately varied per post. NEVER normalise it to "Think of it this way" — that phrase is banned on the finished post.
  5. Evidence            — heading + intro + 2-4 bullets + close. Keep the script's heading as written: it is retitled when the post has no verified number, and must not be normalised back to "What the data shows".
  6. Who it's for / candidacy — heading + intro + bullets + close
  7. Session / protocol  — heading + intro + bullets + close
  8. Final               — CTA stack (NOT in slides[] — goes into cta field)

PRESERVE the script's content faithfully — never drop mechanism detail, evidence
lines, or patient specifics to shorten a slide, and never pad a short slide with
filler. Parse what is there. Never append "Swipe" prompts anywhere.

For each body slide:
  • n: 1-based slide number (cover is n=1; first body is n=2)
  • kind: 'cover' | 'body' | 'cta' — cover only for slide 1; cta is the FINAL
  • heading: short title for the slide (e.g. "What the data shows")
  • intro: optional one-line framing sentence above the bullets
  • bullets: array of short lines (3-7 words each typically). Empty array [] when the slide is prose-only (analogy slide, gap slide).
  • close: the slide's TAKEAWAY — the short landing line the script puts on its own line at the end of the slide (or, for a prose-only slide, the full prose body). Every body slide in a well-formed script has one; carry it across verbatim and never fold it into 'intro' or into a bullet. It is rendered as the bold payoff line on the slide, so it must survive the split intact.

For the cover:
  • title: mixed case headline (NOT all-caps — that was the legacy renderer).
    HARD CAP: at most 7 words, ONE sentence, no trailing period. Never emit a
    multi-sentence title.
    A title must state WHAT THE READER GETS and NAME ITS OBJECT. The shape
    that works is <count> + <verb> + <object>: "Five Things That Build
    Mitochondria", "Four Things That Rebuild Tissue", "Two Tests To Ask For".
    Two forms are BANNED (both were rejected by the reviewer on live posts,
    2026-08-31):
      - the bare topic noun — "Repair", "Peptides", "Five Signals". The topic
        already sits in the cover's pill, so a title that only repeats it
        tells the reader nothing about what is inside.
      - a verb with no object — "Four Things That Help", "Four Ways To
        Rebuild". Help what? Rebuild what? Name it.
    Do NOT shorten a title to make it fit a template: the composer resizes the
    box, and a 32-38 character title fits every master. If the script's cover
    line is longer (e.g. a compliance rewrite expanded it), COMPRESS to the
    headline it was meant to be — the format promise and its object survive,
    the hedge/qualifier ("investigational", "talk to your doctor") moves into
    the hook or drops if the hook already carries it.
  • hook: ONE line that says what the post actually covers — prefer naming the
    items ("A walk, glycine, cold water, sleep, two weeks off alcohol.") or a
    specific stat from the script. It must NOT restate the title's count: a
    cover reading "Four Things That Help" over "Four things that help each one"
    was rejected as repetitive. STRIP any trailing "Swipe →" / "swipe" prompt
    if the script has one — it must never appear on the post.

For the CTA stack:
  • keyword: ALL-CAPS single word from the script (e.g. "VITALITY"). If no keyword in the script, infer from topic or use "CONNECT".
  • follow_line: the Follow line from the script, exactly as written. Null for mental-health-acute stripped variant.
  • comment_line: the Comment "<KEYWORD>" line from the script, exactly as written. Null if no comment/keyword line is present (booking-only CTA).
  • book_line: the Book line from the script. Null for mental-health-acute stripped variant.
  • crisis_line_in_cta: present ONLY for mental-health-acute stripped variant (988 line)

For sources:
  • Each non-trivial factual claim that has a source mentioned in the script — emit a {claim, citation} object. If none, return [].

Mental-health-acute detection: if the topic / hook contains "suicid", "self-harm", "988", "lifeline", "crisis intervention" — the CTA stack is stripped (follow_line + book_line = null; crisis_line_in_cta present; caption.crisis_line mandatory). Skip the analogy slide.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "cover": { "title": "...", "hook": "..." },
  "slides": [
    { "n": 2, "kind": "body", "heading": "...", "intro": "...", "bullets": ["...", "..."], "close": "..." }
  ],
  "cta": {
    "keyword": "...",
    "follow_line": "..." | null,
    "comment_line": "..." | null,
    "book_line": "..." | null,
    "crisis_line_in_cta": null
  },
  "sources": [ { "claim": "...", "citation": "..." } ]
}`

export interface SplitToPostPlanResult {
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  sources: PostPlanSource[]
  // Per-slide photo brief. Populated by the photo-brief Haiku agent
  // after the structural split. Canva compose endpoint resolves each
  // entry (Replicate for 'ai', Drive for 'drive', etc.) when the
  // marketer presses "Compose in Canva".
  photo_brief: PostPlanPhotoBrief[]
}

/**
 * Strip a script's own scaffolding label off a slide line.
 *
 * The writer numbers its beats ("Tip 3.", "Step 2:", "Slide 4 —") and the
 * splitter used to carry them straight into `intro`/`close`. One shipped: the
 * tissue-repair post's page 6 opened with "Tip 3. Even with good nutrition…"
 * and the reviewer counted it as a spelling mistake (Igor 2026-08-31). The
 * label is never content — the slide's position already says which beat it is.
 */
function stripScriptLabel(line: string): string {
  return line.replace(/^\s*(?:tip|step|slide|point|part)\s*#?\d+\s*[.:)—–-]\s*/i, '').trim()
}

export async function splitScriptToPostPlan(
  script: string,
  context?: {
    topic?: string | null
    hook?: string | null
    onStage?: (name: string) => void
    /** CTA mode from the clinic's niche profile. Default: 'manychat' (HWC). */
    ctaMode?: CtaMode
    /** Instagram handle without '@'. Null → generic follow line. */
    socialHandle?: string | null
    /**
     * Plan-assigned ManyChat keyword (content_plan_topics.keyword).
     * When present it is BINDING — overrides whatever the script/LLM
     * produced. The keyword list is curated; never let the model drift.
     */
    ctaKeyword?: string | null
    /**
     * Clinic + its photo library folder. When both are present the
     * photo brief resolves `clinic` slides to real Drive files via the
     * LRU rotation; without them those slides degrade to AI renders.
     */
    clinicId?: string | null
    photoLibraryFolderId?: string | null
    /**
     * `clinics.niche` — picks the photo doctrine (aesthetics = real skin /
     * tools / rooms, no renders; anything else = regenmed v4).
     */
    niche?: string | null
  }
): Promise<SplitToPostPlanResult> {
  if (!script.trim()) {
    throw new Error('splitScriptToPostPlan: script is empty')
  }

  const raw = await callAgentJSON<{
    cover?: Partial<PostPlanCover>
    slides?: Array<Partial<PostPlanBodySlide>>
    cta?: Partial<PostPlanCta>
    sources?: Array<Partial<PostPlanSource>>
  }>({
    model: MODEL_HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    cacheSystem: true,
    userContent: `Topic: ${context?.topic ?? 'n/a'}\nHook: ${context?.hook ?? 'n/a'}\n\nScript:\n\n${script}\n\nSplit into PostPlan JSON now. Preserve the script's wording — do not invent facts. Return only JSON.`,
    maxTokens: 4096,
  })

  // Defensive normalisation. Every field is optional in the model
  // response (defense in depth) — coerce here. The hook strip is a
  // hard guarantee: "Swipe →" tails must never reach a rendered post
  // (Igor, 2026-07-23), even if the model ignores the prompt.
  const cover: PostPlanCover = {
    title: (raw.cover?.title ?? context?.topic ?? '').trim() || 'Untitled',
    hook: (raw.cover?.hook ?? '')
      .replace(/[\s,.—–-]*swipe\s*(→|->)?\s*$/i, '')
      .trim(),
  }

  const slides: PostPlanBodySlide[] = (raw.slides ?? [])
    .map((s, idx): PostPlanBodySlide | null => {
      if (!s || typeof s !== 'object') return null
      const n = typeof s.n === 'number' && s.n > 0 ? s.n : idx + 2
      const kind: 'cover' | 'body' | 'cta' =
        s.kind === 'cover' || s.kind === 'cta' ? s.kind : 'body'
      const bullets = Array.isArray(s.bullets)
        ? s.bullets
            .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
            .map((b) => stripScriptLabel(b))
            .filter((b) => b.length > 0)
        : []
      const heading = s.heading?.trim() || null
      const intro = s.intro ? stripScriptLabel(s.intro) || null : null
      const close = s.close ? stripScriptLabel(s.close) || null : null
      if (!heading && !intro && !close && bullets.length === 0) return null
      return { n, kind, heading, intro, bullets, close }
    })
    .filter((s): s is PostPlanBodySlide => s !== null)

  // Always at least one body slide — if the splitter failed, hold so a
  // human catches it (the compliance gate will see thin output and the
  // route can fall through to legacy rendering).
  if (slides.length === 0) {
    throw new Error('splitScriptToPostPlan: no usable body slides parsed')
  }

  const ctaRaw = raw.cta ?? {}
  const acute = isMentalHealthAcute(
    context?.topic ?? '',
    context?.hook ?? null
  )
  const ctaMode: CtaMode = context?.ctaMode ?? 'manychat'
  const socialHandle = context?.socialHandle ?? null

  // Build the fallback follow line from the social handle.
  // When handle is absent → generic "Follow for ..." without @.
  const fallbackFollowLine = socialHandle
    ? `@${socialHandle} for evidence-based wellness content, no hype.`
    : 'Follow us for evidence-based content, no hype.'

  const fallbackKeyword = suggestCtaKeyword(context?.topic ?? null) ?? null
  // Priority: plan-assigned keyword (BINDING, from the curated ManyChat
  // list) → keyword parsed from the script → slug map → 'CONNECT'.
  // Booking mode doesn't use a ManyChat keyword; neutral placeholder
  // keeps the PostPlan shape valid (keyword is a non-empty string).
  const forcedKeyword = context?.ctaKeyword?.trim()
    ? context.ctaKeyword.trim().toUpperCase()
    : null
  // The pool is BINDING (Igor 2026-08-31). Candidates are offered in priority
  // order and the first one that is a real ManyChat trigger wins; an invented
  // word (the Made SPF post shipped `Comment "PREVENTION"`, which the bot has
  // no trigger for) is dropped here rather than printed on a slide.
  const keyword = ctaMode === 'booking'
    ? 'BOOK'
    : resolveCtaKeyword(
        [forcedKeyword, ctaRaw.keyword?.toString(), fallbackKeyword],
        { niche: context?.niche, topic: context?.topic }
      )

  // The script's comment line quotes the keyword. Rewrite the quoted word
  // whenever it is not the keyword we resolved to — otherwise the slide keeps
  // asking for a word the CTA no longer uses.
  const parsedCommentLine = ctaRaw.comment_line?.trim() || null
  const quoted = parsedCommentLine?.match(/"([A-Za-z0-9+\- ]+)"/)?.[1] ?? null
  const commentLine =
    parsedCommentLine && quoted && quoted.toUpperCase() !== keyword
      ? parsedCommentLine.replace(/"[A-Za-z0-9+\- ]+"/, `"${keyword}"`)
      : parsedCommentLine

  const cta: PostPlanCta = {
    keyword,
    follow_line: acute
      ? null
      : (ctaRaw.follow_line?.trim() || fallbackFollowLine),
    // Booking mode: no comment/keyword mechanic → null.
    // Manychat mode: parse from script or synthesise fallback.
    comment_line: ctaMode === 'booking'
      ? null
      : (commentLine || `"${keyword}" and we'll send the next step.`),
    book_line: acute
      ? null
      : (ctaRaw.book_line?.trim() ||
          'tap the link in bio or DM us to start an evaluation.'),
    crisis_line_in_cta: acute
      ? (ctaRaw.crisis_line_in_cta?.trim() ||
          'In crisis? Call or text 988 — the Suicide & Crisis Lifeline.')
      : null,
  }

  const sources: PostPlanSource[] = (raw.sources ?? [])
    .map((s): PostPlanSource | null => {
      if (!s || typeof s !== 'object') return null
      const claim = s.claim?.trim()
      const citation = s.citation?.trim()
      if (!claim || !citation) return null
      return { claim, citation }
    })
    .filter((s): s is PostPlanSource => s !== null)

  // Photo brief is generated AFTER the structural split so the agent
  // sees the full PostPlan and can decide per-slide source intelligently.
  // Soft-fail to an empty array — the rest of the post is still valid.
  context?.onStage?.('photo_brief:start')
  let photo_brief: PostPlanPhotoBrief[] = []
  try {
    photo_brief = await generatePhotoBriefs({
      cover,
      slides,
      cta,
      topic: context?.topic ?? null,
      category: null,
      niche: context?.niche ?? null,
      clinicId: context?.clinicId ?? null,
      photoLibraryFolderId: context?.photoLibraryFolderId ?? null,
    })
    context?.onStage?.('photo_brief:done')
  } catch (e) {
    console.warn(
      `[splitter] photo_brief generation failed: ${
        e instanceof Error ? e.message : 'unknown'
      }`
    )
  }

  return { cover, slides, cta, sources, photo_brief }
}
