-- ============================================================
-- Content Machine — Migration 009
-- Adds length_target on scripts so the system can keep a pair
-- of "short" (60-90s boost cut) and "long" (2-3min organic)
-- versions of the same idea side by side. Older rows = NULL,
-- treated as "short" by default in code.
-- Run in Supabase SQL Editor after 008.
-- ============================================================

alter table public.scripts
  add column if not exists length_target text
    check (length_target in ('short', 'long'));

-- Pair link: when generation produces both versions of the same
-- idea, store the sibling so the UI can show them together.
alter table public.scripts
  add column if not exists pair_id uuid;

create index if not exists idx_scripts_pair on public.scripts(pair_id)
  where pair_id is not null;
