-- ============================================================
-- Content Machine — Migration 052
-- "From the floor": the photos and clips the medical assistants
-- upload through the Google Form (HWC-MA-Photos-and-Videos handout).
-- The form drops files into a Drive folder; we mirror that folder
-- into the app so the team sees the media in CM, not only in Drive,
-- and gets a push when something new lands.
--
-- Also: admin-scoped push subscriptions, so Igor's device is pinged
-- for events in ANY clinic (a doctor recording, an MA upload) —
-- until now a subscription was pinned to one clinic_id.
-- Run in Supabase SQL Editor after 051.
-- ============================================================

-- The Drive folder the clinic's form writes into. Google Forms names
-- it "<Form> (File responses)" and puts one subfolder per upload
-- question inside — we walk it recursively, so either level works.
alter table public.clinics
  add column if not exists drive_floor_folder_id text;

-- One row per mirrored Drive file.
create table if not exists public.floor_media (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  drive_file_id text not null,
  file_name text not null,
  -- 'photo' | 'video' — the form has a slot for each.
  kind text not null check (kind in ('photo', 'video')),
  mime_type text not null,
  size_bytes bigint,
  width int,
  height int,
  duration_sec real,
  -- Google Forms appends " - <Respondent name>" to the filename;
  -- parsed out on ingest so the gallery can credit the MA.
  uploader text,
  -- Which subfolder it came from ("Photos" / "Video clips") — the
  -- form question name, useful when a clinic adds more slots.
  drive_folder_name text,
  drive_url text not null,
  thumbnail_url text,
  -- Drive createdTime = when the MA uploaded it.
  uploaded_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Re-running the sync on the same file updates, never duplicates.
create unique index if not exists ux_floor_media_file
  on public.floor_media(clinic_id, drive_file_id);

create index if not exists idx_floor_media_clinic
  on public.floor_media(clinic_id, uploaded_at desc);

alter table public.floor_media enable row level security;

drop policy if exists "clinic_isolation_floor_media" on public.floor_media;
create policy "clinic_isolation_floor_media" on public.floor_media
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Admin devices get every clinic's pings, not just the clinic that
-- happened to be selected when the browser subscribed.
alter table public.push_subscriptions
  add column if not exists is_admin boolean not null default false;

create index if not exists push_subscriptions_admin_idx
  on public.push_subscriptions(is_admin) where is_admin;
