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
// The full enum the runner contract uses. SlideSetStatusV2 below is
// kept as an alias for compat with code that imports the newer name.
// Migration 028 renames live 'needs_review' rows → 'review' so this
// file is the single source of truth from 2026-06-17 onwards.
export type SlideSetStatus =
  | 'pending'           // system: just created, awaiting compliance grade
  | 'review'            // human/medical: compliance returned REVIEW
  | 'blocked'           // marketer: compliance REMOVE/REWORD — fix findings
  | 'ready_for_canva'   // runner: queued for Canva pipeline
  | 'in_canva'          // runner: composing now
  | 'visuals_ready'     // marketer: render_result populated, review the dest
  | 'approved'          // marketer: ack'd; NOT auto-published
  | 'published'         // manual: flipped after IG/Buffer post
  | 'rendered'          // legacy — pre-contract write path; never set anymore
  | 'exported'          // legacy — same

export interface ClinicProfile {
  id: string
  name: string
  /** DB value, e.g. 'regenerative_medicine' | 'aesthetics'. Unknown → profiles.ts fallbacks to regenmed. */
  niche: string
  /** Instagram handle without '@'. Null → generic follow line (no @). */
  social_handle: string | null
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

// Structured plan context injected into Writer when a post is generated
// from the editorial calendar (90% path). Null in ad-hoc mode (10% path).
export interface PlanContext {
  week_number: number
  theme: string
  pillar: string
  keyword: string | null
  topic: string
}

export interface SharedContext {
  clinic_profile: ClinicProfile
  raw_insights: Insight[]
  trend_signals: TrendSignal[]
  content_memory: ContentItem[]
  few_shot_library: ScriptExample[]
  format_templates: ScriptFormatTemplate[]
  diff_rules: DiffRule[]
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

// ——— Role-assigned scripts (Studio) ———
// Who delivers a line on camera. Studio ideas come with a speaker
// breakdown so the film team knows who says what. Operator = the person
// behind the camera (can give a spoken line or just an action/direction).
export type SpeakerRole = 'Doctor' | 'Operator' | 'Patient' | 'Assistant' | 'Narrator'

export interface RoleBlock {
  speaker: SpeakerRole
  text: string
  direction?: string | null // stage direction, e.g. "holds up knee model"
}

// Optional per-format role spec. When present, the Writer emits
// role_blocks using only the allowed speakers.
export interface RolePlan {
  speakers: SpeakerRole[]
  guidance?: string | null
  default_length?: ScriptLengthTarget | null
}

// What gets stored in scripts.role_blocks for a Studio idea: the simple
// "what we'll film" steps + the speaker-labelled script. Studio-only;
// legacy rows store a bare RoleBlock[] (no steps) and stay readable.
export interface StudioRolePayload {
  steps: string[]
  blocks: RoleBlock[]
}

export interface ScriptVariant {
  id: string
  topic: string
  hook: string
  script: string
  word_count: number
  estimated_seconds: number
  template_name?: string | null
  // Speaker-labelled rendition of `script`. Present only when the
  // Writer ran in role mode (Studio). NULL/absent = monologue.
  role_blocks?: RoleBlock[] | null
  // Simple, numbered "what we'll film" steps for non-actor clinic staff.
  // Present only in Studio role mode.
  summary_steps?: string[] | null
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

// ─── Compliance gate (HANDOFF-POSTS.md §16 + §19) ─────────────────
// Output of lib/agents/compliance.ts. Stored in slide_sets.compliance
// JSONB so the medical director / counsel can review later.
//
// Grade vocabulary follows the compliance ruleset v2.1:
//   REMOVE   — content violates a hard rule (e.g. disease cure claim,
//              exosome offered as service, FDA-approved on non-approved
//              product). NEVER auto-publish.
//   REWORD   — fixable wording issue (missing hedge, dropped trial
//              criterion, wrong FDA date). Marketer or medical director
//              edits and re-runs the gate.
//   REVIEW   — borderline finding that needs human judgement. Holds in
//              UI; does not auto-publish but does not block either.
//   PASS     — no findings. Eligible for ready_for_canva. The gate
//              still emits an empty findings[] array — bare "PASS"
//              strings are forbidden per the ruleset.
export type ComplianceGrade = 'REMOVE' | 'REWORD' | 'REVIEW' | 'PASS'

export interface ComplianceFinding {
  rule: string                           // 'R-FDA-01' | 'FACT_TMS_DATE' | etc
  severity: 'remove' | 'reword' | 'review'
  matched: string                         // exact excerpt that triggered
  correction: string                      // suggested correction
  source: 'factCheck' | 'llm'             // which pass produced it
}

export interface ComplianceResult {
  grade: ComplianceGrade
  findings: ComplianceFinding[]
  model: string                           // 'claude-opus-4-7' or 'factCheck-only'
  ruleset_version: string                 // 'v2.1' from docs/compliance-ruleset.md
  run_at: string                          // ISO timestamp
}

// ─── Post plan (HANDOFF-POSTS.md §15 target output shape) ──────────
// What the writer + splitter + captioner ultimately produce. Stored
// in slide_sets.slides as JSONB, plus slide_sets.plan_id for cron
// rotation, plus slide_sets.compliance for the gate verdict.

export interface PostPlanCover {
  title: string                           // mixed case headline
  hook: string                            // one specific stat or framing line
}

export interface PostPlanBodySlide {
  n: number                                // 1-based slide number
  kind: 'cover' | 'body' | 'cta'
  heading?: string | null                  // chip / title
  intro?: string | null                    // framing sentence above bullets
  bullets?: string[] | null                // 2-4 short lines (NEW vs legacy TypedSlide.text)
  close?: string | null                    // pivot line after bullets
}

export interface PostPlanCta {
  keyword: string                          // ALL-CAPS single word, e.g. 'VITALITY'. 'BOOK' for booking-niche.
  follow_line: string | null               // null for mental-health-acute stripped variant
  comment_line: string | null              // null for booking CTA mode (no ManyChat keyword mechanic)
  book_line: string | null                 // null for mental-health-acute stripped variant
  crisis_line_in_cta?: string | null       // present only when acute trigger fires
}

export interface PostPlanPhotoBrief {
  n: number
  source: 'ai' | 'stock' | 'fallback'
  subject: string                          // human-readable for the picker
  prompt?: string | null                   // present when source: 'ai'
  keywords?: string[] | null               // present when source: 'stock'
}

export interface PostPlanCaption {
  body: string
  hashtags: string[]
  crisis_line: string | null               // mandatory for Mental Health bucket
}

export interface PostPlanSource {
  claim: string
  citation: string
}

export interface PostPlan {
  plan_id: string | null                   // 'POST 18' if from rotation, null if ad-hoc
  category: string                         // 'Mental Health' | 'Pain & Joint' | etc
  topic_slug: string                       // kebab-case identifier
  cover: PostPlanCover
  slides: PostPlanBodySlide[]
  cta: PostPlanCta
  caption: PostPlanCaption
  photo_brief: PostPlanPhotoBrief[]
  sources: PostPlanSource[]                // INTERNAL — never appears in caption
}

// ─── Slide set lifecycle (HANDOFF-POSTS.md §22.3) ──────────────────
// Backwards alias. SlideSetStatus above is the single source of truth.
export type SlideSetStatusV2 = SlideSetStatus

// Contract column slide_sets.render_result (migration 028). Owned by
// the Canva runner — Content Machine reads it, never writes (except
// to nullify on regenerate). schema_version lets the runner evolve
// the payload shape without DB migrations.
export interface RenderResult {
  schema_version: number
  channel: 'carousel' | 'reel' | 'story'
  canva_edit_url: string
  outputs: Array<{
    kind: 'slide' | 'cover'
    page: number              // 1-indexed; page=1 is cover/preview
    url: string               // PNG URL — Canva-hosted, may expire
  }>
  assets_used: string[]
  cost_usd: number
  ts: string                   // ISO timestamp the runner wrote this
}
