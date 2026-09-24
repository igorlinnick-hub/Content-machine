import {
  callAgentTool,
  callAgentVisionJSON,
  MODEL_HAIKU,
  type VisionImageInput,
} from './base'
import { llmAgentsEnabled } from './disabled'

// ============================================================
// Note tidy — the janitor, not the editor.
//
// The binding contract (Igor 2026-09-23): the user dumps ideas as they
// come — any order, any language, typos, half-sentences. The AI fixes
// spelling/grammar and puts a light structure on the pile (group what
// is clearly the same idea, one bullet per idea). It NEVER: merges two
// ideas into one, drops an idea as "weak", rewrites a thought in nicer
// words, reorders by its own taste of importance, or adds ideas of its
// own. If the model can't tell whether two lines are one idea or two —
// they are two. When in doubt, keep the user's words.
// ============================================================

export interface TidyResult {
  title: string
  body: string
  flags: string[]
}

const TIDY_SYSTEM = `You are a note janitor for a content-ideas scratchpad. The user dumps raw ideas — mixed Russian/English, typos, fragments, no order.

Your ONLY job:
1. Fix spelling, grammar and punctuation IN THE LANGUAGE EACH LINE IS WRITTEN IN. Never translate.
2. Organize the pile lightly: one bullet ("- ") per distinct idea. If several lines are obviously the same thought, keep them together as one bullet with sub-lines. If a few bullets clearly share a topic, you may put a short "## " heading above the group — only when the grouping is obvious.
3. Give the note a short title (max 6 words, the language the note is mostly in).

HARD RULES — breaking any of these is a failure:
- Every idea in the input appears in the output. Never drop, merge, or summarize ideas away.
- Never rewrite a thought "better". Keep the user's own words and phrasing; fix only mechanics (spelling, grammar, punctuation, capitalization).
- Never add ideas, suggestions, examples, or commentary of your own.
- Never rank or reorder by importance. Keep the user's order except when moving a line into its obvious topic group.
- Unsure whether two lines are one idea or two? They are two.
- Unreadable or ambiguous fragment? Keep it verbatim and add a flag describing what was unclear.

Flags are short notes about anything you could not confidently handle (e.g. "line 4: unclear abbreviation 'скв' — left as written"). Empty array when everything was clear.`

const TIDY_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string', description: 'Short title, max 6 words' },
    body: {
      type: 'string',
      description:
        'The tidied note as markdown: "- " bullets, optional "## " group headings. Every input idea present, user\'s own wording kept.',
    },
    flags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Anything unclear/ambiguous, kept verbatim in body',
    },
  },
  required: ['title', 'body', 'flags'],
}

export async function tidyNote(rawText: string): Promise<TidyResult> {
  return callAgentTool<TidyResult>({
    model: MODEL_HAIKU,
    systemPrompt: TIDY_SYSTEM,
    userContent: `Tidy this note:\n\n${rawText}`,
    toolName: 'save_tidied_note',
    toolDescription: 'Save the tidied version of the note',
    inputSchema: TIDY_SCHEMA,
    maxTokens: 4096,
    cacheSystem: true,
  })
}

// ------------------------------------------------------------
// Photo transcription — read handwriting off a photographed page.
// Transcribes VERBATIM; the tidy contract above is applied by a
// second pass on the transcription, so a bad tidy never costs the
// original text (raw_body = the verbatim transcription).
// ------------------------------------------------------------

export interface TranscriptionResult {
  text: string
  flags: string[]
}

const TRANSCRIBE_SYSTEM = `You transcribe handwritten or printed notes from photos. The pages hold content ideas in Russian and/or English.

Rules:
- Transcribe VERBATIM: the writer's exact words, spelling mistakes included. Do not fix, translate, reorder, or summarize anything at this stage.
- Preserve the visual structure: line breaks, bullets/dashes, arrows ("->"), indentation, headings — as plain text.
- Multiple photos = one note photographed in parts; transcribe them in the order given, separated by a blank line.
- A word you cannot read: write [unreadable] in its place and add a flag saying where (e.g. "page 1, line 3: one unreadable word").
- Crossed-out text: skip it (the writer rejected it), but flag that something was crossed out.
- Margin notes and arrows to other lines: transcribe where they visually belong and flag the placement guess.

Respond with JSON only: {"text": "...", "flags": ["..."]}. Empty flags array when the whole page was legible.`

export async function transcribeNotePhotos(
  images: VisionImageInput[]
): Promise<TranscriptionResult> {
  return callAgentVisionJSON<TranscriptionResult>({
    // Sonnet, not Haiku: handwriting is the one place cheap vision
    // actually loses words, and a lost word here is lost forever.
    model: 'claude-sonnet-4-6',
    systemPrompt: TRANSCRIBE_SYSTEM,
    userText:
      images.length > 1
        ? `Transcribe these ${images.length} photos as one note, in order.`
        : 'Transcribe this photo.',
    images,
    maxTokens: 4096,
    cacheSystem: true,
  })
}

export function noteTidyEnabled(): boolean {
  return llmAgentsEnabled()
}
