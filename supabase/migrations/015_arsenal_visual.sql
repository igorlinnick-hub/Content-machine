-- ============================================================
-- Content Machine — Migration 015
-- Phase A of the arsenal back-office: visual analysis output,
-- mp4/thumbnail storage references, and the operator-refinement
-- loop ("разверни про b-roll подробнее"). All extraction work
-- still happens in the local Claude Code skill — these are just
-- the columns it writes into and the bucket it uploads to.
--
-- Run in Supabase SQL Editor after 014.
-- ============================================================

alter table public.script_arsenal
  -- Output of the in-skill multimodal visual pass. Shape (set by skill):
  --   { storyboard: [{ sec, description, broll_type }],
  --     pacing: string, broll_pattern: string, hook_visual: string }
  -- Empty {} when the skill has not run visual analysis yet.
  add column if not exists visual_notes jsonb not null default '{}'::jsonb,

  -- Supabase Storage object key in the `arsenal-videos` bucket. The
  -- public URL is derived from this in lib/arsenal/storage.ts. Null
  -- until the skill has uploaded the mp4.
  add column if not exists video_storage_path text,
  add column if not exists thumbnail_storage_path text,

  -- Operator-driven refinement: the admin UI writes a free-form note
  -- here ("разверни про b-roll", "перегенери хуки на боль о коленях"),
  -- the skill polls /api/arsenal/refine-queue, reads the note, applies
  -- it to the existing transcript+keyframes, and clears the column on
  -- success. refine_history keeps an append-only log so we can show a
  -- changelog in the UI without diff'ing rows.
  add column if not exists pending_refine_note text,
  add column if not exists refined_at timestamptz,
  add column if not exists refine_history jsonb not null default '[]'::jsonb;

create index if not exists idx_script_arsenal_refine_pending
  on public.script_arsenal(clinic_id)
  where pending_refine_note is not null;

-- ------------------------------------------------------------
-- Supabase Storage bucket for arsenal mp4s + thumbnails.
-- Public bucket (matches existing `clinic-videos` pattern) so the
-- dashboard <video> element can play directly. 200MB file cap is
-- generous for a 60-90s reel at 1080p.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arsenal-videos',
  'arsenal-videos',
  true,
  209715200,
  array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
