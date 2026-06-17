-- ============================================================
-- Content Machine — Migration 025
-- Fixes the live error:
--   "new row for relation 'slide_sets' violates check constraint
--    'slide_sets_status_check' (23514)"
--
-- Migration 024 documented the extended status vocabulary in comments
-- but didn't drop the old CHECK constraint that was inherited from an
-- earlier slide_sets migration. The pipeline writes 'needs_review' /
-- 'ready_for_canva' / 'blocked' which the old constraint rejects.
--
-- Decision: drop the constraint entirely. App-level validation in
-- lib/posts/pipeline.ts.statusFromCompliance() is the single source
-- of truth for valid status values. A DB-side enum adds rebuild
-- friction every time we want a new lifecycle state.
--
-- Run in Supabase SQL Editor after 024.
-- ============================================================

alter table public.slide_sets
  drop constraint if exists slide_sets_status_check;
