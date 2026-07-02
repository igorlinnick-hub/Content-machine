import { MODEL_DEFAULT, callAgentTool } from '@/lib/agents/base'
import type { WhisperSegment } from './whisper'

// Retake detector — Sonnet pass over Whisper segments that flags
// abandoned takes: explicit restart markers ("let me start over",
// "sorry, again") and earlier occurrences of re-recorded passages.
// planCuts only sees the surviving segments, so a dropped take
// collapses like any other silence gap.
//
// Fail-open by design: this is an enhancement pass, not a required
// stage. Any error — kill switch, model outage, malformed output —
// returns zero drops and the clip still gets cleaned with the
// filler/silence cuts only.

const SYSTEM_PROMPT = `You are a take editor for talking-head clips (a doctor speaking to camera in one continuous recording).

INPUT: numbered transcript segments with timestamps.

TASK: find segments that belong to ABANDONED TAKES — places where the speaker flubbed a line and started over. Two patterns:
1. Explicit restart markers: "let me start over", "one more time", "sorry, again", "wait, let me redo that", "scratch that", counting in ("3, 2, 1"), clap cues.
2. Near-duplicate repeats: the same sentence/passage appears more than once with small wording changes because the speaker re-recorded it. The LAST occurrence is the good take — the earlier occurrence(s) and any restart marker between them are the retake.

RULES:
- Drop the aborted take AND the restart marker itself.
- NEVER drop the final (last) occurrence of a repeated passage.
- Deliberate rhetorical repetition (emphasis, callbacks, "again:" as a teaching device) is NOT a retake — keep it.
- Be conservative: when unsure, KEEP the segment. A false cut is worse than a leftover retake.
- No retakes found → return an empty list.`

interface RetakeReport {
  drops: Array<{ id: number; reason: string }>
}

// Refuse the model's answer when it wants to drop more than this share
// of segments — a real recording is mostly good takes, so an aggressive
// answer is more likely a hallucination than a genuine cut plan.
const MAX_DROP_RATIO = 0.4

export interface RetakeDrops {
  dropIds: Set<number>
  count: number
}

const NO_DROPS: RetakeDrops = { dropIds: new Set(), count: 0 }

export async function detectRetakeDrops(
  segments: WhisperSegment[]
): Promise<RetakeDrops> {
  // Too short to contain a retake worth an API call.
  if (segments.length < 3) return NO_DROPS

  const numbered = segments
    .map(
      (s) => `[${s.id}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}: ${s.text}`
    )
    .join('\n')

  try {
    // Sonnet, not Haiku: this call decides what gets DELETED from a
    // doctor's video. Runs once per clip on a small transcript, so the
    // accuracy upgrade costs cents while a wrong cut costs a reshoot.
    const report = await callAgentTool<RetakeReport>({
      model: MODEL_DEFAULT,
      systemPrompt: SYSTEM_PROMPT,
      userContent: `SEGMENTS:\n${numbered}\n\nReport the retake segments to drop.`,
      toolName: 'report_retakes',
      toolDescription:
        'Report which transcript segments are abandoned takes / restart markers and must be dropped from the final cut.',
      inputSchema: {
        type: 'object',
        properties: {
          drops: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Segment id from the input list',
                },
                reason: {
                  type: 'string',
                  description:
                    'Short reason: restart marker / earlier take of a repeated passage',
                },
              },
              required: ['id', 'reason'],
            },
          },
        },
        required: ['drops'],
      },
      maxTokens: 1000,
      cacheSystem: true,
    })

    const validIds = new Set(segments.map((s) => s.id))
    const dropIds = new Set(
      (report.drops ?? []).map((d) => d.id).filter((id) => validIds.has(id))
    )
    if (dropIds.size === 0) return NO_DROPS
    if (dropIds.size / segments.length > MAX_DROP_RATIO) {
      console.warn(
        `retakes: model wanted to drop ${dropIds.size}/${segments.length} segments — over ${MAX_DROP_RATIO} ratio, ignoring`
      )
      return NO_DROPS
    }
    return { dropIds, count: dropIds.size }
  } catch (e) {
    console.warn(
      `retakes: detection skipped — ${e instanceof Error ? e.message : 'unknown error'}`
    )
    return NO_DROPS
  }
}
