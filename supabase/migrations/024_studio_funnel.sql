-- ============================================================
-- Content Machine — Migration 024 (Studio funnel)
-- Turns the Studio base into a 3-stage funnel for the film team:
--
--   candidate  -> a reel pulled in (discovery service / manual link).
--   liked      -> anyone on the team 👍'd it (open to all).
--   shotlist   -> the admin promoted it to "we're filming this"
--                 (admin-only final pick — the boss's folder).
--   rejected   -> 👎 skipped.
--
-- Generate-idea runs on Shot List items; the latest idea is pinned per
-- video via current_script_id so the card stays stable on reload.
-- Run in Supabase SQL Editor after 023.
-- ============================================================

alter table public.studio_videos
  add column if not exists status text not null default 'candidate'
    check (status in ('candidate', 'liked', 'shotlist', 'rejected')),
  -- The most recently generated shoot idea for this video (Shot List).
  add column if not exists current_script_id uuid
    references public.scripts(id) on delete set null;

create index if not exists idx_studio_videos_status
  on public.studio_videos(clinic_id, status, created_at desc);
