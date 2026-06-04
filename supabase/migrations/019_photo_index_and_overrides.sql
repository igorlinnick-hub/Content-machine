-- ============================================================
-- Content Machine — Migration 019
-- Photo intelligence: index Drive-folder photos with vision-based
-- descriptions so the matcher can recommend the right photo per
-- slide. Plus per-slide override field on slide_sets so the team's
-- manual pick beats the auto-cycle.
--
-- Run in Supabase SQL Editor after 018.
-- ============================================================

-- ─── photo_index ──────────────────────────────────────────────
-- One row per Drive image we've described with Claude Vision.
-- Re-index only when description is stale (description_model
-- changed) or when the file is new (not in the index yet).
create table if not exists public.photo_index (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  drive_folder_id text not null,
  drive_file_id text not null,
  file_name text,
  description text not null,           -- 1-2 sentence vision description
  tags text[] default '{}',            -- short keywords for fuzzy match
  description_model text not null,     -- e.g. 'claude-haiku-4-5-20251001'
  indexed_at timestamptz not null default now(),
  unique (clinic_id, drive_file_id)
);

create index if not exists idx_photo_index_folder
  on public.photo_index(drive_folder_id);

create index if not exists idx_photo_index_clinic
  on public.photo_index(clinic_id);

-- ─── slide_sets.photo_overrides ──────────────────────────────
-- JSONB map of slideIndex (string) → drive_file_id.
-- E.g. { "1": "1A2B3C...", "2": "4D5E6F..." }
-- Cover (index 0) is normally null — no photo on cover layout.
-- When set, photos.ts loader prefers this over the auto-cycle.
alter table public.slide_sets
  add column if not exists photo_overrides jsonb default '{}'::jsonb;
