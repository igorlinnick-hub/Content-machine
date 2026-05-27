-- ============================================================
-- Content Machine — Migration 018
-- Persist which format-template scaffold Writer picked for each
-- variant. Writer already emits template_name in its JSON output
-- but we were dropping it on save — now the column exists, gets
-- written by saveScripts(), and shows up on every script card so
-- the admin can see at a glance which scaffold produced what.
-- Nullable for back-compat with rows generated before this column.
-- Run in Supabase SQL Editor after 017.
-- ============================================================

alter table public.scripts
  add column if not exists template_used text;

create index if not exists idx_scripts_template_used
  on public.scripts(clinic_id, template_used)
  where template_used is not null;
