-- ============================================================
-- Content Machine — Migration 065 (hand-added scripts)
--
-- "+ Add your own script" on /scripts lets the marketing team paste a
-- script they wrote themselves. Those rows never went through Writer or
-- Critic, so the compliance gate runs on save and its verdict lands in
-- scripts.compliance (migration 050).
--
--   source — NULL     = written by the machine (Writer / Studio)
--            'manual' = pasted in by a person
--
-- pruneOldScripts keeps a 30-row window of machine output and must never
-- delete a person's own script — it filters on this column.
--
-- Run in Supabase SQL Editor after 064.
-- ============================================================

alter table public.scripts
  add column if not exists source text;

alter table public.scripts
  drop constraint if exists scripts_source_check;
alter table public.scripts
  add constraint scripts_source_check
  check (source is null or source = 'manual');
