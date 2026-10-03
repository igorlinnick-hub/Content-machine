-- ============================================================
-- Content Machine — Migration 059
-- Voice notes: tap the mic, talk, get an organized note.
--
-- Third input next to typed and photo. The recording itself is kept
-- (same bucket, storage_paths already cleans up on delete) and linked
-- via audio_url, so the spoken original stays checkable the same way
-- a photographed page does — Whisper's text is raw_body, never the
-- ground truth itself.
-- Run in Supabase SQL Editor after 058.
-- ============================================================

alter table public.idea_notes
  drop constraint if exists idea_notes_source_check;
alter table public.idea_notes
  add constraint idea_notes_source_check
  check (source in ('typed', 'photo', 'voice'));

alter table public.idea_notes
  add column if not exists audio_url text;
