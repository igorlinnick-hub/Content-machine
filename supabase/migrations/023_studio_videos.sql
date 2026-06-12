-- ============================================================
-- Content Machine — Migration 023 (Studio videos — SEPARATE base)
-- The Studio board (clinic film team) has its OWN curated video base,
-- completely separate from script_arsenal (which feeds the doctor's
-- written scripts). They must never mix: script_arsenal = writing styles
-- for the Writer; studio_videos = "what to film" reference reels the
-- marketing team uploads for the people who shoot content.
--
-- Studio columns are pinned to rows here. Files (mp4 + thumb) live in the
-- shared arsenal-videos storage bucket — the bucket is just storage; the
-- separation is at the table level.
--
-- Also repoints studio_slots from script_arsenal -> studio_videos.
-- Run in Supabase SQL Editor after 022.
-- ============================================================

create table if not exists public.studio_videos (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  source_url text,
  source_platform text,
  author_handle text,
  view_count bigint,
  title text,
  -- One-liner: what makes this format work (drives idea generation).
  style_description text,
  -- { beats: [{ name, text }] } — the format's structure for the schema view.
  structure jsonb not null default '{}'::jsonb,
  -- Original post caption — extra context for the idea Writer.
  caption text,
  video_storage_path text,
  thumbnail_storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_studio_videos_active
  on public.studio_videos(clinic_id, view_count desc nulls last)
  where is_active;

alter table public.studio_videos enable row level security;
drop policy if exists "clinic_isolation_studio_videos" on public.studio_videos;
create policy "clinic_isolation_studio_videos" on public.studio_videos
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- ------------------------------------------------------------
-- Repoint studio_slots: it pinned script_arsenal rows; now it pins
-- studio_videos rows. No Studio data exists yet, so this is a clean swap.

alter table public.studio_slots
  drop constraint if exists studio_slots_arsenal_id_fkey;

alter table public.studio_slots
  rename column arsenal_id to studio_video_id;

alter table public.studio_slots
  add constraint studio_slots_studio_video_id_fkey
  foreign key (studio_video_id) references public.studio_videos(id) on delete set null;
