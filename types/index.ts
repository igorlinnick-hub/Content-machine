import type { Database } from './supabase'

type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type ClinicRow = Row<'clinics'>
export type DoctorNoteRow = Row<'doctor_notes'>
export type InsightRow = Row<'insights'>
export type TrendSignalRow = Row<'trend_signals'>
export type ScriptRow = Row<'scripts'>
export type ScriptFinalRow = Row<'script_finals'>
export type FewShotRow = Row<'few_shot_library'>
export type DiffRuleRow = Row<'diff_rules'>
export type SlideSetRow = Row<'slide_sets'>

export type Tone = 'professional' | 'educational' | 'conversational'
export type InsightType = 'story' | 'opinion' | 'angle' | 'hook'
export type NoteSource = 'widget' | 'voice' | 'text'
export type SlideSetStatus = 'pending' | 'rendered' | 'exported'

export interface ClinicProfile {
  id: string
  name: string
  niche: 'regenerative_medicine'
  services: string[]
  audience: string
  tone: Tone
  doctor_name: string
  medical_restrictions: string[]
  content_pillars: string[]
  deep_dive_topics: string[]
}

export type FeedbackAction = 'selected' | 'rejected'

export interface ScriptFeedbackEntry {
  id: string
  script_id: string
  action: FeedbackAction
  topic: string | null
  hook: string | null
  full_script: string
  created_at: string
}

export interface Insight {
  id: string
  type: InsightType
  content: string
  used_count: number
  created_at: string
}

export interface TrendSignal {
  id: string
  topic: string
  why_relevant: string | null
  hook_angle: string | null
  expires_at: string | null
  created_at: string
}

export interface ContentItem {
  id: string
  topic: string | null
  hook: string | null
  full_script: string
  created_at: string
}

export interface ScriptExample {
  id: string
  script_text: string
  why_good: string | null
  topic: string | null
  score: number | null
}

export type ScriptLengthTarget = 'short' | 'long'

export interface ScriptFormatTemplate {
  id: string
  name: string
  description: string | null
  scaffold: string
  length_bias: ScriptLengthTarget | null
}

export interface DiffRule {
  id: string
  rule: string
  example_before: string | null
  example_after: string | null
  priority: number
}

export interface VisualStyle {
  canvas: { width: number; height: number }
  background: { type: 'photo' | 'color'; overlay_opacity: number }
  text: {
    primary: {
      font: string
      size: number
      color: string
      position: 'top' | 'center' | 'bottom'
    }
    secondary: {
      font: string
      size: number
      color: string
    }
  }
  logo: { url: string; position: string; size: number }
  padding: number
  // HWC-style brand tokens. Used by the typed-slide renderer for cover /
  // body / cta layouts. Optional so legacy slide_sets without brand keep
  // working — renderer falls back to plain text + photo bg.
  brand?: {
    primary: string       // navy — card backgrounds, headlines on white
    accent: string        // sky — chips, gradient highlight, hover
    surface: string       // white — cover bg
    surface_text: string  // dark — text on white
    card_text: string     // white — text on navy cards
  }
}

export type SlideKind = 'cover' | 'body' | 'cta'

// Typed slide payload that the splitter agent produces. Renderer dispatches
// to a different layout for each kind. Backward compat: legacy `string[]`
// slides are coerced to `[{kind:'cover'}, {kind:'body'}*, {kind:'cta'}]`
// by position.
export interface TypedSlide {
  kind: SlideKind
  text: string                 // primary content (body card on body, headline on cover, action line on cta)
  chip?: string | null         // top eyebrow / chip ("MYTHS", "Myth 1", category name)
  subtext?: string | null      // secondary line — subhead under cover headline, or smaller line on cta
}

export interface SharedContext {
  clinic_profile: ClinicProfile
  raw_insights: Insight[]
  trend_signals: TrendSignal[]
  content_memory: ContentItem[]
  few_shot_library: ScriptExample[]
  format_templates: ScriptFormatTemplate[]
  diff_rules: DiffRule[]
  style_template: VisualStyle
  recent_picks: ScriptFeedbackEntry[]
  recent_rejects: ScriptFeedbackEntry[]
}

// ——— Agent I/O shapes (will be used in Step 3) ———

export interface AnalystOutput {
  stories: { text: string; topic: string }[]
  opinions: { text: string; strength: number }[]
  angles: string[]
  hooks: string[]
}

export interface ResearchOutput {
  trending_topics: {
    topic: string
    why_relevant: string
    hook_angle: string
  }[]
  working_hooks: string[]
  avoid_topics: string[]
}

export interface ScriptVariant {
  id: string
  topic: string
  hook: string
  script: string
  word_count: number
  estimated_seconds: number
  template_name?: string | null
}

export interface WriterOutput {
  variants: ScriptVariant[]
}

export interface CriticScore {
  variant_id: string
  total_score: number
  criteria: {
    tone_match: number
    no_promises: number
    hook_quality: number
    length_ok: number
    science_present: number
  }
  approved: boolean
  feedback: string
}

export interface CriticOutput {
  scores: CriticScore[]
}

export interface DiffPattern {
  rule: string
  example_before: string
  example_after: string
  priority: number
}

export interface DiffOutput {
  patterns: DiffPattern[]
  add_to_few_shot: boolean
}
