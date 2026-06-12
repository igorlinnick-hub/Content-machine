import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'
import type {
  PostPlanBodySlide,
  PostPlanCover,
  PostPlanCta,
  PostPlanSource,
} from '@/types'
import { suggestCtaKeyword, isMentalHealthAcute } from '@/lib/seeds/cta-keywords'

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

const SYSTEM_PROMPT = `You convert a finished Hawaii Wellness Clinic carousel SCRIPT into the canonical PostPlan JSON shape. The script you receive was already written following the HWC structural arc — your job is to PARSE it into structured slide data, NOT rewrite it.

Slide arc (in order):
  1. Cover               — title + hook
  2. Mechanism / Real cause — heading + intro + 2-4 bullets + close
  3. Optional gap slide  — heading + intro + close (no bullets)
  4. "Think of it this way" analogy — heading "Think of it this way" + prose body in 'close' field
  5. What the data shows — heading + intro + 2-4 bullets + close
  6. Who it's for / candidacy — heading + intro + bullets + close
  7. Session / protocol  — heading + intro + bullets + close
  8. Final               — CTA stack (NOT in slides[] — goes into cta field)

For each body slide:
  • n: 1-based slide number (cover is n=1; first body is n=2)
  • kind: 'cover' | 'body' | 'cta' — cover only for slide 1; cta is the FINAL
  • heading: short title for the slide (e.g. "What the data shows")
  • intro: optional one-line framing sentence above the bullets
  • bullets: array of short lines (3-7 words each typically). Empty array [] when the slide is prose-only (analogy slide, gap slide).
  • close: closing line or full prose body of the slide

For the cover:
  • title: mixed case headline (NOT all-caps — that was the legacy renderer)
  • hook: one specific stat or framing line ending with "Swipe →"

For the CTA stack:
  • keyword: ALL-CAPS single word from the script (e.g. "VITALITY"). If not in script, infer from topic.
  • follow_line: usually "@hawaiiwellness for science-backed wellness, no hype." OR null for mental-health-acute stripped variant
  • comment_line: the comment "<KEYWORD>" + what we send line
  • book_line: usually "tap the link in bio or DM us to start an evaluation." OR null for stripped variant
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
    "comment_line": "...",
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
}

export async function splitScriptToPostPlan(
  script: string,
  context?: { topic?: string | null; hook?: string | null }
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
  // response (defense in depth) — coerce here.
  const cover: PostPlanCover = {
    title: (raw.cover?.title ?? context?.topic ?? '').trim() || 'Untitled',
    hook: (raw.cover?.hook ?? '').trim(),
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
            .map((b) => b.trim())
        : []
      const heading = s.heading?.trim() || null
      const intro = s.intro?.trim() || null
      const close = s.close?.trim() || null
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
  const fallbackKeyword = suggestCtaKeyword(context?.topic ?? null) ?? null
  const keyword =
    (ctaRaw.keyword?.toString().trim() || fallbackKeyword || 'CONNECT').toUpperCase()

  const cta: PostPlanCta = {
    keyword,
    follow_line: acute
      ? null
      : (ctaRaw.follow_line?.trim() ||
          '@hawaiiwellness for science-backed wellness, no hype.'),
    comment_line:
      ctaRaw.comment_line?.trim() ||
      `"${keyword}" and we'll send the next step.`,
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

  return { cover, slides, cta, sources }
}
