-- 035_structured_content_plan.sql
-- Per-doctor structured content plan: weeks + enriched topics.
-- Extends content_plan_topics (adds week_id, keyword).
-- Adds content_plan_start to clinics for per-doctor cycle offset.

-- ──────────────────────────────────────────────────────────────
-- 1. New table: content_plan_weeks
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_plan_weeks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  week_number int         NOT NULL,
  theme       text        NOT NULL,
  pillar      text        NOT NULL,
  description text,
  position    int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_plan_weeks_clinic_pos_idx
  ON content_plan_weeks(clinic_id, position);

ALTER TABLE content_plan_weeks ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (server-side only, like scheduled_posts).
CREATE POLICY "service_role_all_content_plan_weeks"
  ON content_plan_weeks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- 2. Extend content_plan_topics
-- week_id links a topic to its editorial week (nullable — existing
-- cron/posts-pipeline rows stay orphaned and keep working as before).
-- keyword is the ManyChat CTA trigger word for the post.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE content_plan_topics
  ADD COLUMN IF NOT EXISTS week_id uuid REFERENCES content_plan_weeks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS keyword text;

CREATE INDEX IF NOT EXISTS content_plan_topics_week_id_idx
  ON content_plan_topics(week_id)
  WHERE week_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. Extend clinics: per-doctor cycle start date
-- NULL → use 2026-06-01 (matches legacy hardcoded PLAN_START).
-- ──────────────────────────────────────────────────────────────
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS content_plan_start date;
