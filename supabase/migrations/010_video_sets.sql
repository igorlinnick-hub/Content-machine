-- ============================================================
-- Content Machine — Migration 010
-- Adds video_sets: per-clinic library of generated short videos
-- (Seedance 2.0 via Replicate). Mirrors slide_sets in shape so the
-- UI workspace can list / preview / download them next to posts.
-- Run in Supabase SQL Editor after 009.
-- ============================================================

create table if not exists public.video_sets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete set null,
  -- The Seedance prompt we sent to Replicate (string, multi-paragraph).
  prompt text not null,
  -- Replicate prediction id, model id, kept for billing reconciliation.
  replicate_prediction_id text,
  replicate_model text,
  -- Output mp4 URL — Replicate-hosted CDN. Lives ~24h on their side, so
  -- we mirror to Supabase Storage and keep the public URL here.
  storage_path text,
  public_url text,
  -- Generation params (aspect ratio, duration, resolution).
  params jsonb,
  duration_sec real,
  aspect_ratio text,
  resolution text,
  category_id uuid references public.clinic_categories(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','generating','rendered','failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_sets_clinic
  on public.video_sets(clinic_id, created_at desc);

create index if not exists idx_video_sets_script
  on public.video_sets(script_id) where script_id is not null;

alter table public.video_sets enable row level security;

drop policy if exists "clinic_isolation_video_sets" on public.video_sets;
create policy "clinic_isolation_video_sets" on public.video_sets
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Public bucket for generated mp4s. Service-role uploads, public reads
-- so the <video> tag in the UI can stream them straight.
insert into storage.buckets (id, name, public)
values ('clinic-videos', 'clinic-videos', true)
on conflict (id) do nothing;
