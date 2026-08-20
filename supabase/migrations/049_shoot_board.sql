-- ============================================================
-- Content Machine — Migration 049 (Shoot board for MAs)
-- Turns the Shot List into a dated board the medical assistants open on
-- their own link. Three additions, all backwards compatible:
--
--  1. studio_videos.shoot_date — the day this gets filmed. One video per
--     day per clinic (enforced by a partial unique index over clinic +
--     date). NULL = not scheduled, which is how every existing row stays.
--  2. studio_videos.embed_url — for reels we DON'T copy into our bucket
--     (Instagram): the official iframe URL, so the MA watches in-app
--     without downloading and we store no mp4. NULL for our own uploads,
--     which keep playing from video_storage_path as before.
--  3. clinics.shoot_board_token — the shareable read-only link. Separate
--     from access_tokens on purpose: that grants a clinic-wide role, and
--     this must only ever expose the dated shoot cards.
--
-- Run in Supabase SQL Editor after 048.
-- ============================================================

alter table public.studio_videos
  add column if not exists shoot_date date,
  add column if not exists embed_url text;

-- One shoot per clinic per day. Partial: unscheduled rows (NULL) are
-- exempt, and there can be any number of them.
create unique index if not exists uq_studio_videos_shoot_day
  on public.studio_videos(clinic_id, shoot_date)
  where shoot_date is not null;

-- The board reads "everything from today forward", so index that order.
create index if not exists idx_studio_videos_shoot_date
  on public.studio_videos(clinic_id, shoot_date)
  where shoot_date is not null;

-- ------------------------------------------------------------

alter table public.clinics
  add column if not exists shoot_board_token text;

-- Tokens are global secrets: unique across every clinic, not per-clinic.
create unique index if not exists uq_clinics_shoot_board_token
  on public.clinics(shoot_board_token)
  where shoot_board_token is not null;
