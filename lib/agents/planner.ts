import type { ClinicProfile } from '@/types'
import { MODEL_DEFAULT, callAgentTool } from './base'
import type { ReplaceWeekInput } from '@/lib/content-plan/store'

export interface PlannerOutput {
  weeks: ReplaceWeekInput[]
}

const SYSTEM_PROMPT = `You are an editorial content strategist for a medical clinic's social media (Instagram, TikTok, YouTube Shorts).

Given a clinic's profile — their services, content pillars, deep-dive topics, audience, and tone — generate an 8-week content plan with exactly 3 posts per week (24 posts total).

Rules:
- Each week has a THEME (a specific focus area, e.g. "Botox & Facial Harmony") and a PILLAR (must be one of the clinic's content_pillars exactly as listed)
- Rotate pillars across the 8 weeks — don't repeat the same pillar more than 2-3 times unless the clinic has fewer than 4 pillars
- Each post has a TOPIC (the specific video/carousel topic, patient-facing, 6-12 words) and a KEYWORD (1-2 words, the ManyChat CTA trigger word for this post — should match the core treatment or mechanism)
- Topics must be educational, mechanism-focused, or patient-question-based (not generic)
- Each week's 3 posts should build on each other (e.g. mechanism → patient question → result/protocol)
- Ground topics in the clinic's actual services and deep-dive topics
- Write all topics in English
- Generate a short description for each week explaining the editorial angle`

export async function runPlanner(profile: ClinicProfile): Promise<PlannerOutput> {
  const userContent = `Generate an 8-week content plan for this clinic.

Name: ${profile.name}
Doctor: ${profile.doctor_name || 'n/a'}
Services: ${profile.services?.join(', ') || 'n/a'}
Content pillars: ${profile.content_pillars?.join(', ') || 'n/a'}
Deep-dive topics: ${profile.deep_dive_topics?.join(', ') || 'n/a'}
Audience: ${profile.audience || 'adult patients considering treatments'}
Tone: ${profile.tone || 'educational'}`

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
                  required: ['topic', 'keyword'],
                  properties: {
                    topic: { type: 'string', description: 'Patient-facing post topic, 6-12 words' },
                    keyword: { type: 'string', description: 'ManyChat CTA trigger keyword, 1-2 words' },
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
