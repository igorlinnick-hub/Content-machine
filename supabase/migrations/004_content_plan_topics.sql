-- ============================================================
-- Content Machine — Migration 004
-- Adds content_plan_topics: a per-clinic ordered list of post
-- ideas. The admin pastes/edits a plan; clicking "Generate"
-- on a topic runs the full pipeline (writer → critic → slides)
-- and links the resulting script to the topic.
-- Run in Supabase SQL Editor after 003.
-- ============================================================

create table if not exists public.content_plan_topics (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  topic text not null,
  position int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  last_script_id uuid references public.scripts(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_plan_topics_clinic
  on public.content_plan_topics(clinic_id, position);

create index if not exists idx_content_plan_topics_pending
  on public.content_plan_topics(clinic_id, position)
  where status = 'pending';

alter table public.content_plan_topics enable row level security;
