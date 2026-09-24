-- ============================================================
-- Content Machine — Migration 058
-- Structured uncertainties for idea_notes.
--
-- tidy_flags (text[]) was a wall of prose — "word 'focou' may be
-- 'follow' or 'focus'" — that the user had to read, judge and then fix
-- by hand in the editor. Igor 2026-09-23: make each uncertainty a tap —
-- the word, 1-3 candidate readings as buttons, plus a custom input.
-- That needs structure, not sentences:
--   [{ "text": "focou", "options": ["follow","focus"], "note": "…" }]
-- `text` is the EXACT spelling in body, so applying a choice is a
-- string replace. tidy_flags stays for remarks that aren't a choice
-- (crossed-out lines, placement guesses).
-- Run in Supabase SQL Editor after 057.
-- ============================================================

alter table public.idea_notes
  add column if not exists tidy_issues jsonb not null default '[]'::jsonb;
