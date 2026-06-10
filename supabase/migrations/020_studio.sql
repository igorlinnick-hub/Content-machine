-- ============================================================
-- Content Machine — Migration 020 (Studio)
-- Powers the /studio window: a horizontal board of "columns" for
-- the clinic film team. Each column pins ONE high-performing
-- reference video (from script_arsenal) and shows, top→bottom:
--   account + view count -> playable video -> structure schema
--   -> collapsed template -> a generated idea (with role blocks).
--
-- Two new pieces:
--  1. view_count + author_handle on script_arsenal — captured by
--     the ingest skill (yt-dlp --print view_count,uploader). Used
--     to rank the video pool and to badge each column (@handle,
--     "1.2M views"). The "Change video" button picks the next
--     arsenal entry with view_count >= 200000.
--  2. studio_slots — persists which video + which generated idea
--     live in each column, so a reload is stable and the video
--     only changes when the user presses "Change video".
--
-- Backwards compatible: both new arsenal columns are nullable;
-- existing rows keep working (UI just omits the view/account
-- badge when null). Run in Supabase SQL Editor after 019.
-- ============================================================

alter table public.script_arsenal
  -- View/play count from the source platform at ingest time.
  -- Nullable: legacy rows + platforms where it can't be read.
  add column if not exists view_count bigint,
  -- Source account handle (e.g. '@drsmith') shown atop the column.
  add column if not exists author_handle text;

-- Rank the active pool by reach; partial index keeps it small.
create index if not exists idx_arsenal_views
  on public.script_arsenal(clinic_id, view_count desc nulls last)
  where is_active;

-- ------------------------------------------------------------

create table if not exists public.studio_slots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  -- Column position in the horizontal board (0..N, seed = 3).
  slot_index int not null,
  -- The reference video currently pinned in this column.
  arsenal_id uuid references public.script_arsenal(id) on delete set null,
  -- The most recently generated idea shown under the template.
  current_script_id uuid references public.scripts(id) on delete set null,
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_studio_slot
  on public.studio_slots(clinic_id, slot_index);

alter table public.studio_slots enable row level security;

drop policy if exists "clinic_isolation_studio_slots" on public.studio_slots;
create policy "clinic_isolation_studio_slots" on public.studio_slots
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);
