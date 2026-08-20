import type { ClinicProfile } from '@/types'
import { MODEL_DEFAULT, callAgentTool } from './base'
import type { ReplaceWeekInput } from '@/lib/content-plan/store'
import { keywordPoolForNiche } from '@/lib/seeds/cta-keywords'
import { POST_FORMATS, FORMAT_NAMES } from '@/lib/posts/formats'
import { getNicheProfile } from '@/lib/niche/profiles'

export interface PlannerOutput {
  weeks: ReplaceWeekInput[]
}

// The catalog is `lib/posts/formats.ts` — the same list the marketer's format
// buttons write into content_plan_topics.format. The planner only picks a
// starting rotation; the button is what finally decides HOW a post is written.
const FORMAT_BLOCK = POST_FORMATS.map(
  (f, i) => `  ${i + 1}. ${f.name} — ${f.hint}`
).join('\n')

// Aesthetics reads differently from regenerative medicine: the audience is
// browsing, not troubleshooting a chronic problem (Igor 2026-08-20). Same
// topic-quality rules, different mood — light, practical, encouraging.
const AESTHETICS_TONE_BLOCK = `NICHE TONE — MEDICAL AESTHETICS (BINDING for this clinic):
The mood is light, warm and practical — self-care a reader looks forward to, never a medical problem to be fixed. Lead with what people can DO and what they can expect, not with pathology.
- Favour topics that give: practical care tips, what to do before and after a treatment, how to keep results longer, how to choose well, what is normal and what is not, seasonal and everyday skin habits.
- Frame ageing and appearance NEUTRALLY. Never shame a face or a body, never imply the reader looks wrong or needs fixing, never use fear or urgency ("before it's too late"). No before/after promises.
- Guidance, not verdicts: the reader is deciding for themselves and the post helps them decide well.
- Keep it patient-facing and jargon-free — injector shop-talk (units, anatomy names, product brands as headline words) does not belong in a topic.`

/** Niche-specific tone rules appended to both planner prompts. */
function toneBlockFor(niche: string | null | undefined): string {
  return getNicheProfile(niche).id === 'aesthetics'
    ? `${AESTHETICS_TONE_BLOCK}\n\n`
    : ''
}

function buildPlanPrompt(keywordBlock: string, toneBlock: string): string {
  return `You are an editorial content strategist for a medical clinic's social media (Instagram, TikTok, YouTube Shorts).

Given a clinic's profile — their services, content pillars, deep-dive topics, audience, and tone — generate an 8-week content plan with exactly 3 posts per week (24 posts total).

Rules:
- Each week has a THEME (a specific focus area, e.g. "Botox & Facial Harmony") and a PILLAR (must be one of the clinic's content_pillars exactly as listed)
- Rotate pillars across the 8 weeks — don't repeat the same pillar more than 2-3 times unless the clinic has fewer than 4 pillars
- If the PUBLISHED CONTENT HISTORY shows that a pillar was recently posted 2+ times, deprioritize that pillar — don't assign it to Week 1 or 2; give the audience a break from it first
- Each post has a TOPIC (the specific video/carousel topic, patient-facing, 6-12 words), a KEYWORD (the ManyChat CTA trigger word — must be chosen ONLY from the lists below), and a FORMAT
- FORMAT must be one of these structural templates — rotate them across the 24 posts so every format is used at least twice and none more than four times:
${FORMAT_BLOCK}
- Rotate formats so each week has at most 2 posts of the same format
- Every week should mix registers: do not give a week three explainers or three list posts. A week that teaches a mechanism, gives a practical list, and flags what to check reads far better than three of a kind
- Match the format to the topic: a mechanism topic wants Educational explainer or Diagnostic deep-dive; a self-care / routine topic wants Practical tips; a "should I get this checked" topic wants Warning signs; a widely-believed falsehood wants Myth-busting
- Topics must be educational, mechanism-focused, or patient-question-based (not generic)
- Each week's 3 posts should build on each other (e.g. mechanism → patient question → result/protocol)
- Ground topics in the clinic's actual services and deep-dive topics
TOPIC QUALITY (HARD RULES — Igor 2026-08-20):
- A topic names the READER'S problem or question, in words a patient would actually say or type. The reader is the hero of every topic — never the clinic, never the doctor.
- NEVER put the doctor's name in a topic ("What Dr. X tells patients…", "X's philosophy on…", "X's approach to…"). The doctor's voice lives inside the post; a topic list sprinkled with the doctor's name reads as self-promotion and produces near-identical posts.
- NEVER promise an outcome in a topic ("lost 40 pounds", "reversed", "pain-free in weeks"). Compliance strips the number and the post collapses. A patient-story topic names the SITUATION and the turning point ("Decades of failed diets — what was actually missing"), never the result.
- ENTRY-POINT VARIETY inside every week: the week's topics must enter through DIFFERENT doors — a symptom the reader feels; a mechanism they're curious about; a decision they face (X vs surgery, when to say no); a misconception; a self-check / which test to ask for; an at-home habit. No two topics in the same week may both be "treatment name + angle".
- Across the whole plan, at most HALF the topics may lead with a treatment/brand name (GLP-1, PRP, NAD+, …). The other half leads with the reader's life: the 3pm crash, knees on stairs, sleep after 40, skin in the mirror.
- The same drug or treatment may headline at most 3 topics across the entire plan.
- Write all topics in English
- Generate a short description for each week explaining the editorial angle

${toneBlock}VALID KEYWORDS (use ONLY these — do not invent new ones):
${keywordBlock}
Pick the keyword that best matches the post topic. Never invent a keyword not in these lists.`
}

// ─── Single-topic reroll ──────────────────────────────────────────
// The marketer rejects one topic chip; generate ONE replacement that
// still fits the same week's theme + pillar and doesn't collide with
// anything else in the plan.

function buildRerollPrompt(keywordBlock: string, toneBlock: string): string {
  return `You are an editorial content strategist for a medical clinic's social media.

Generate exactly ONE new post topic for the given week of a content plan — either REPLACING a topic the marketer rejected, or ADDING one more on top of the existing ones (the task line in the input says which).

Rules:
- The new topic must fit the week's THEME and PILLAR
- It must NOT duplicate or paraphrase the rejected topic (if any), the week's other topics, or any topic listed under AVOID
- Patient-facing, 6-12 words, educational / mechanism-focused / patient-question-based (not generic)
- KEYWORD must be chosen ONLY from the valid ManyChat lists below, matching the pillar
- FORMAT must be one of these templates; prefer one the week doesn't already use, and one that suits the topic:
${FORMAT_BLOCK}

TOPIC QUALITY (HARD): the topic names the READER'S problem or question in their own words — never the doctor's name in a topic, never a promised outcome ("lost 40 pounds"), and prefer an entry point the week doesn't already use (symptom felt / mechanism / decision / misconception / self-check / at-home habit) over another "treatment name + angle" line.

${toneBlock}VALID KEYWORDS (use ONLY these — do not invent new ones):
${keywordBlock}`
}

export interface RerollTopicInput {
  profile: ClinicProfile
  week: { theme: string; pillar: string; description?: string | null }
  /** Topics staying in this week — the new one must complement them. */
  keepTopics: string[]
  /** The rejected topic (replace mode). Omit to ADD an extra topic. */
  rejectedTopic?: string
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
  const pool = keywordPoolForNiche(profile.niche)
  const userContent = `Clinic: ${profile.name}
Services: ${profile.services?.join(', ') || 'n/a'}
Deep-dive topics: ${profile.deep_dive_topics?.join(', ') || 'n/a'}
Audience: ${profile.audience || 'adult patients considering treatments'}

Week theme: ${week.theme}
Week pillar: ${week.pillar}
${week.description ? `Week angle: ${week.description}` : ''}

Task: ${
    input.rejectedTopic
      ? `REPLACE this rejected topic (do not rephrase it): ${input.rejectedTopic}`
      : 'ADD one more topic to this week, on top of the existing ones.'
  }
Topics staying in the week: ${input.keepTopics.join(' | ') || 'none'}
AVOID (already planned or recently posted): ${(input.avoidTopics ?? []).join(' | ') || 'none'}`

  return callAgentTool<RerolledTopic>({
    model: MODEL_DEFAULT,
    systemPrompt: buildRerollPrompt(pool.promptBlock, toneBlockFor(profile.niche)),
    userContent,
    toolName: 'submit_replacement_topic',
    toolDescription: 'Submit the single replacement post topic',
    inputSchema: {
      type: 'object',
      required: ['topic', 'keyword', 'format'],
      properties: {
        topic: { type: 'string', description: 'Patient-facing post topic, 6-12 words' },
        keyword: { type: 'string', enum: pool.keywords, description: 'CTA trigger keyword for this niche' },
        format: { type: 'string', enum: FORMAT_NAMES, description: 'Structural format template' },
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
  const pool = keywordPoolForNiche(profile.niche)
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
    systemPrompt: buildPlanPrompt(pool.promptBlock, toneBlockFor(profile.niche)),
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
                    keyword: { type: 'string', enum: pool.keywords, description: 'CTA trigger keyword — must be one of the valid keywords for this niche' },
                    format: { type: 'string', enum: FORMAT_NAMES, description: 'Structural format template for this post' },
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
