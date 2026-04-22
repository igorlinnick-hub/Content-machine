-- ============================================================
-- Content Machine — Migration 002
-- Adds content_pillars + deep_dive_topics to clinics.
-- Creates script_feedback table for behavior-based style learning
-- (doctor picks/rejects variants → writer uses history).
-- Run this in Supabase SQL Editor after schema.sql.
-- ============================================================

-- New clinic columns (nullable / default empty array for existing rows)
alter table public.clinics
  add column if not exists content_pillars text[] default '{}'::text[];

alter table public.clinics
  add column if not exists deep_dive_topics text[] default '{}'::text[];

-- Pick/pass log for generated script variants
create table if not exists public.script_feedback (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete cascade,
  action text not null check (action in ('selected', 'rejected')),
  created_at timestamptz default now()
);

create index if not exists idx_script_feedback_clinic
  on public.script_feedback(clinic_id, created_at desc);

create index if not exists idx_script_feedback_script
  on public.script_feedback(script_id);

-- RLS matches the existing pattern
alter table public.script_feedback enable row level security;

drop policy if exists "clinic_isolation_script_feedback" on public.script_feedback;
create policy "clinic_isolation_script_feedback" on public.script_feedback
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);
