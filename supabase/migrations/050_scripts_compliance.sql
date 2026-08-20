-- ============================================================
-- Content Machine — Migration 050 (compliance verdict on scripts)
--
-- Posts already store their gate verdict in `slide_sets.compliance`
-- (migration 024). Studio shoot briefs are `scripts` rows, which had
-- nowhere to record one — so the Studio path never ran the gate at all.
-- That was tolerable while the Shot List was an internal admin board.
-- It stopped being tolerable when migration 049 put those briefs on a
-- public link that clinic staff open and film from.
--
-- Same shape as slide_sets.compliance: { grade, findings[], model,
-- ruleset_version, run_at }. NULL = never graded (every existing row),
-- which the MA board treats as "not cleared" rather than "fine".
--
-- Run in Supabase SQL Editor after 049.
-- ============================================================

alter table public.scripts
  add column if not exists compliance jsonb;

-- The board filters on the verdict for one clinic's scheduled briefs;
-- the grade lives inside the JSONB so index the expression.
create index if not exists idx_scripts_compliance_grade
  on public.scripts((compliance->>'grade'))
  where compliance is not null;
