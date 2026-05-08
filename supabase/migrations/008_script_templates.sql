-- ============================================================
-- Content Machine — Migration 008
-- Adds script_templates: a per-clinic library of FORMAT
-- scaffolds (system critique, diagnostic deep-dive, patient
-- story, expert secrets, medicine philosophy, ...). Distinct
-- from few_shot_library, which captures topic+voice samples.
-- These templates are STRUCTURE-only: they teach the writer
-- "how to lay out a post" without dictating the topic.
-- Run in Supabase SQL Editor after 007.
-- ============================================================

create table if not exists public.script_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  scaffold text not null,
  -- Optional bias: "short" (60-90s), "long" (2-3min), or null = both work.
  length_bias text check (length_bias in ('short', 'long')),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_script_templates_clinic
  on public.script_templates(clinic_id, position);

create index if not exists idx_script_templates_clinic_active
  on public.script_templates(clinic_id, active)
  where active = true;

alter table public.script_templates enable row level security;

drop policy if exists "clinic_isolation_script_templates" on public.script_templates;
create policy "clinic_isolation_script_templates" on public.script_templates
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);
