-- ============================================================
-- Content Machine — Migration 051
-- Ads (Igor 2026-08-20). `scripts.length_target` was capped at the two
-- organic bands by 009. The paid-spot target ('ad', ~90-140 words / 25-45s,
-- see lib/scripts/ad-formats.ts) is a third band, and an ad script has to be
-- able to say so: the library and the teleprompter otherwise cannot tell a
-- 30-second spot from a 90-second organic script except by guessing at
-- `template_used`.
--
-- Widening a check constraint only — no data is touched, and every existing
-- row already satisfies the new predicate.
-- Run in Supabase SQL Editor after 050.
-- ============================================================

-- 009 created the constraint inline (`add column ... check (...)`), so its
-- name was auto-generated. Drop whatever check currently guards the column
-- rather than trusting that name to be the default one.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'scripts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%length_target%'
  loop
    execute format('alter table public.scripts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.scripts
  add constraint scripts_length_target_check
    check (length_target is null or length_target in ('short', 'long', 'ad'));
