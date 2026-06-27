-- Migration 036: Add social_handle column to clinics
-- Used by Writer + Splitter to build the Follow line in the CTA stack.
-- Nullable so existing clinics are not affected until explicitly set.
--
-- Backfill: set 'hawaiiwellness' for the HWC regenmed clinic so
-- Dr. Shawn's CTA continues to say "@hawaiiwellness" after the migration.
-- Run a targeted UPDATE after applying (via admin or Supabase SQL editor):
--   UPDATE clinics SET social_handle = 'hawaiiwellness'
--   WHERE niche = 'regenerative_medicine' AND social_handle IS NULL;

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS social_handle text;

-- Index is not needed (queried by id, not by handle). No FK.
-- RLS inherited from the table's existing policies (row-level by clinic_id).
