import type { ClinicProfile } from '@/types'
import { MODEL_DEFAULT, callAgentTool } from './base'
import type { ReplaceWeekInput } from '@/lib/content-plan/store'
import { MANYCHAT_CTA_CATEGORIES } from '@/lib/seeds/cta-keywords'

const ALL_VALID_KEYWORDS = [
  ...MANYCHAT_CTA_CATEGORIES.mental_health,
  ...MANYCHAT_CTA_CATEGORIES.pain_joint,
  ...MANYCHAT_CTA_CATEGORIES.wellness_vitality,
  ...MANYCHAT_CTA_CATEGORIES.weight_loss,
] as const

export interface PlannerOutput {
  weeks: ReplaceWeekInput[]
}

const FORMAT_NAMES = [
  'System critique',
  'Diagnostic deep-dive',
  'Patient story',
  'Expert secrets',
  'Medicine philosophy',
  'Myth-busting',
] as const

const SYSTEM_PROMPT = `You are an editorial content strategist for a medical clinic's social media (Instagram, TikTok, YouTube Shorts).

Given a clinic's profile — their services, content pillars, deep-dive topics, audience, and tone — generate an 8-week content plan with exactly 3 posts per week (24 posts total).

Rules:
- Each week has a THEME (a specific focus area, e.g. "Botox & Facial Harmony") and a PILLAR (must be one of the clinic's content_pillars exactly as listed)
- Rotate pillars across the 8 weeks — don't repeat the same pillar more than 2-3 times unless the clinic has fewer than 4 pillars
- If the PUBLISHED CONTENT HISTORY shows that a pillar was recently posted 2+ times, deprioritize that pillar — don't assign it to Week 1 or 2; give the audience a break from it first
- Each post has a TOPIC (the specific video/carousel topic, patient-facing, 6-12 words), a KEYWORD (the ManyChat CTA trigger word — must be chosen ONLY from the lists below), and a FORMAT
- FORMAT must be one of these 6 structural templates — rotate all 6 evenly across the 24 posts (each format appears exactly 4 times):
  1. System critique — why mainstream care fails this problem
  2. Diagnostic deep-dive — unpack the real mechanism behind a symptom
  3. Patient story — anonymised case the doctor sees often
  4. Expert secrets — what the doctor tells a friend but not in a 10-min visit
  5. Medicine philosophy — short opinionated piece on how the doctor thinks
  6. Myth-busting — debunk 3 common misconceptions
- Rotate formats so each week has at most 2 posts of the same format
- Topics must be educational, mechanism-focused, or patient-question-based (not generic)
- Each week's 3 posts should build on each other (e.g. mechanism → patient question → result/protocol)
- Ground topics in the clinic's actual services and deep-dive topics
- Write all topics in English
- Generate a short description for each week explaining the editorial angle

VALID MANYCHAT KEYWORDS (use ONLY these — do not invent new ones):
Mental Health pillar: ${MANYCHAT_CTA_CATEGORIES.mental_health.join(', ')}
Pain & Joint pillar: ${MANYCHAT_CTA_CATEGORIES.pain_joint.join(', ')}
Wellness & Vitality pillar: ${MANYCHAT_CTA_CATEGORIES.wellness_vitality.join(', ')}
Weight Loss pillar: ${MANYCHAT_CTA_CATEGORIES.weight_loss.join(', ')}
Pick the keyword that best matches the post topic. Never invent a keyword not in these lists.`

// ─── Single-topic reroll ──────────────────────────────────────────
// The marketer rejects one topic chip; generate ONE replacement that
// still fits the same week's theme + pillar and doesn't collide with
// anything else in the plan.

const REROLL_SYSTEM_PROMPT = `You are an editorial content strategist for a medical clinic's social media.

The marketer rejected ONE post topic from a weekly content plan. Generate exactly ONE replacement topic for the same week.

Rules:
- The replacement must fit the week's THEME and PILLAR
- It must NOT duplicate or paraphrase the rejected topic, the week's other topics, or any topic listed under AVOID
- Patient-facing, 6-12 words, educational / mechanism-focused / patient-question-based (not generic)
- KEYWORD must be chosen ONLY from the valid ManyChat lists below, matching the pillar
- FORMAT must be one of the 6 templates; prefer one the week doesn't already use:
  1. System critique — why mainstream care fails this problem
  2. Diagnostic deep-dive — unpack the real mechanism behind a symptom
  3. Patient story — anonymised case the doctor sees often
  4. Expert secrets — what the doctor tells a friend but not in a 10-min visit
  5. Medicine philosophy — short opinionated piece on how the doctor thinks
  6. Myth-busting — debunk 3 common misconceptions

VALID MANYCHAT KEYWORDS (use ONLY these — do not invent new ones):
Mental Health pillar: ${MANYCHAT_CTA_CATEGORIES.mental_health.join(', ')}
Pain & Joint pillar: ${MANYCHAT_CTA_CATEGORIES.pain_joint.join(', ')}
Wellness & Vitality pillar: ${MANYCHAT_CTA_CATEGORIES.wellness_vitality.join(', ')}
Weight Loss pillar: ${MANYCHAT_CTA_CATEGORIES.weight_loss.join(', ')}`

export interface RerollTopicInput {
  profile: ClinicProfile
  week: { theme: string; pillar: string; description?: string | null }
  /** Topics staying in this week — the replacement must complement them. */
  keepTopics: string[]
  /** The topic the marketer rejected. */
  rejectedTopic: string
  /** Other topics across the plan / recent posts — avoid collisions. */
  avoidTopics?: string[]
}

export interface RerolledTopic {
  topic: string
  keyword: string
  format: string
}

export async function rerollTopic(input: RerollTopicInput): Promise<RerolledTopic> {
  const { profile, week } = input
  const userContent = `Clinic: ${profile.name}
Services: ${profile.services?.join(', ') || 'n/a'}
Deep-dive topics: ${profile.deep_dive_topics?.join(', ') || 'n/a'}
Audience: ${profile.audience || 'adult patients considering treatments'}

Week theme: ${week.theme}
Week pillar: ${week.pillar}
${week.description ? `Week angle: ${week.description}` : ''}

REJECTED topic (replace this, do not rephrase it): ${input.rejectedTopic}
Topics staying in the week: ${input.keepTopics.join(' | ') || 'none'}
AVOID (already planned or recently posted): ${(input.avoidTopics ?? []).join(' | ') || 'none'}`

  return callAgentTool<RerolledTopic>({
    model: MODEL_DEFAULT,
    systemPrompt: REROLL_SYSTEM_PROMPT,
    userContent,
    toolName: 'submit_replacement_topic',
    toolDescription: 'Submit the single replacement post topic',
    inputSchema: {
      type: 'object',
      required: ['topic', 'keyword', 'format'],
      properties: {
        topic: { type: 'string', description: 'Patient-facing post topic, 6-12 words' },
        keyword: { type: 'string', enum: [...ALL_VALID_KEYWORDS], description: 'ManyChat CTA trigger keyword' },
        format: { type: 'string', enum: [...FORMAT_NAMES], description: 'Structural format template' },
      },
    },
    maxTokens: 500,
    cacheSystem: true,
  })
}

export interface PlannerOptions {
  publishedContext?: string
}

export async function runPlanner(profile: ClinicProfile, opts: PlannerOptions = {}): Promise<PlannerOutput> {
  const publishedBlock = opts.publishedContext
    ? `\n\nPUBLISHED CONTENT HISTORY (from Instagram — use this to avoid repetition and double down on what works):\n${opts.publishedContext}`
    : ''

  const userContent = `Generate an 8-week content plan for this clinic.

Name: ${profile.name}
Doctor: ${profile.doctor_name || 'n/a'}
Services: ${profile.services?.join(', ') || 'n/a'}
Content pillars: ${profile.content_pillars?.join(', ') || 'n/a'}
Deep-dive topics: ${profile.deep_dive_topics?.join(', ') || 'n/a'}
Audience: ${profile.audience || 'adult patients considering treatments'}
Tone: ${profile.tone || 'educational'}${publishedBlock}`

  return callAgentTool<PlannerOutput>({
    model: MODEL_DEFAULT,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    toolName: 'submit_content_plan',
    toolDescription: 'Submit the generated 8-week content plan',
    inputSchema: {
      type: 'object',
      required: ['weeks'],
      properties: {
        weeks: {
          type: 'array',
          minItems: 8,
          maxItems: 8,
          items: {
            type: 'object',
            required: ['week_number', 'theme', 'pillar', 'posts'],
            properties: {
              week_number: { type: 'integer', minimum: 1, maximum: 8 },
              theme: { type: 'string', description: 'Week focus theme, e.g. "Botox & Facial Harmony"' },
              pillar: { type: 'string', description: 'One of the clinic content_pillars (exact match)' },
              description: { type: 'string', description: 'Brief editorial angle for this week' },
              posts: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'object',
                  required: ['topic', 'keyword', 'format'],
                  properties: {
                    topic: { type: 'string', description: 'Patient-facing post topic, 6-12 words' },
                    keyword: { type: 'string', enum: [...ALL_VALID_KEYWORDS], description: 'ManyChat CTA trigger keyword — must be one of the valid keywords' },
                    format: { type: 'string', enum: [...FORMAT_NAMES], description: 'Structural format template for this post' },
                  },
                },
              },
            },
          },
        },
      },
    },
    maxTokens: 4000,
    cacheSystem: true,
  })
}
