-- ============================================================
-- Content Machine — Migration 048
-- Clinic photo library: rotation state + per-clinic source folder.
--
-- Photo doctrine v4 (Igor, 2026-08-17): carousel photos come from
-- THREE sources — AI (3D medical renders + Hawaii nature only, no more
-- AI people), the clinic's own Drive library (~40%), and Pexels for
-- explicit context only (1-2 per post). A photo must not come back
-- until it has rested: selection is least-recently-used with a
-- cooldown, not top-to-bottom and not random.
--
-- Run in Supabase SQL Editor after 047.
-- ============================================================

-- ─── rotation state on photo_index ──────────────────────────
-- last_used_at drives the cooldown window; use_count is for the
-- admin UI ("this one has been in 9 posts") and for tie-breaking
-- when every candidate is equally rested.
alter table public.photo_index
  add column if not exists last_used_at timestamptz,
  add column if not exists use_count integer not null default 0;

-- The selector's hot path: "photos in this folder, rested longest
-- first". NULLS FIRST — a never-used photo outranks every used one.
create index if not exists idx_photo_index_rotation
  on public.photo_index(clinic_id, drive_folder_id, last_used_at nulls first);

-- ─── per-clinic photo library folder ────────────────────────
-- The Drive folder the carousel pipeline pulls clinic photos from.
-- Separate from clinic_categories.drive_folder_id (visual posts) —
-- that one is per-category, this is the whole clinic's library.
-- HWC: "HWC Pictures Google" (shared read-only with the service
-- account 2026-08-17).
alter table public.clinics
  add column if not exists photo_library_folder_id text;

comment on column public.clinics.photo_library_folder_id is
  'Drive folder id for the clinic''s own photo library, walked 2 levels deep by getPhotosFromFolder. Must be shared with GOOGLE_SERVICE_ACCOUNT_EMAIL as reader.';

-- ─── bump_photo_usage ────────────────────────────────────────
-- Stamps a batch of photos as used, atomically. A plain read-then-write
-- from the app would lose increments when two posts compose at once.
create or replace function public.bump_photo_usage(
  p_clinic_id uuid,
  p_file_ids text[]
) returns void
language sql
as $$
  update public.photo_index
     set last_used_at = now(),
         use_count = use_count + 1
   where clinic_id = p_clinic_id
     and drive_file_id = any(p_file_ids);
$$;

-- ─── rotation clock starts on a SUCCESSFUL compose ───────────
-- The Canva runner talks to PostgREST directly, so there is no server
-- route to hang this off — the transition into 'visuals_ready' is the
-- only reliable "this post actually shipped its photos" signal. The
-- plan (with photo_brief) lives in slide_sets.slides; legacy rows hold
-- a bare array there, in which case ->'photo_brief' is null and the
-- coalesce makes this a no-op.
create or replace function public.bump_photos_on_compose()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'visuals_ready' and old.status is distinct from new.status then
    update public.photo_index pi
       set last_used_at = now(),
           use_count = pi.use_count + 1
      from jsonb_array_elements(
             coalesce(new.slides -> 'photo_brief', '[]'::jsonb)
           ) as b
     where b ->> 'drive_file_id' is not null
       and pi.clinic_id = new.clinic_id
       and pi.drive_file_id = b ->> 'drive_file_id';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_photos_on_compose on public.slide_sets;
create trigger trg_bump_photos_on_compose
  after update of status on public.slide_sets
  for each row execute function public.bump_photos_on_compose();
