-- ============================================================
-- Content Machine — Migration 027
-- Wires the slide_sets table for the Canva compose pipeline.
--
-- Two new columns:
--   canva_design_url  — final Canva design URL once compose succeeds.
--                       NULL until the marketer presses "Compose in
--                       Canva" (or the auto pipeline runs).
--   compose_status    — lifecycle of the compose pipeline, separate
--                       from the editorial/compliance status:
--                         'idle'    — no compose attempted
--                         'queued'  — request received, pipeline starting
--                         'rendering' — generating photos / uploading
--                         'ready'   — canva_design_url is populated
--                         'failed'  — pipeline blew up; see compose_error
--   compose_error     — short message when compose_status='failed'
--                       (so the UI can surface it without a log dive).
--
-- No CHECK constraint on compose_status — app-level validation in
-- lib/canva/compose.ts is the source of truth (same lesson as
-- migration 025).
--
-- Run in Supabase SQL Editor after 026.
-- ============================================================

alter table public.slide_sets
  add column if not exists canva_design_url text,
  add column if not exists compose_status text default 'idle',
  add column if not exists compose_error text;

-- Index lets the UI quickly fetch every post that's still waiting on
-- a compose, e.g. on /visual when the marketer wants a "Compose all
-- ready posts" batch button later.
create index if not exists slide_sets_compose_status_idx
  on public.slide_sets (clinic_id, compose_status);
