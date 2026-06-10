-- ============================================================
-- Content Machine — Migration 021 (role-assigned scripts)
-- Studio ideas come with a speaker breakdown: who says what on
-- camera (Doctor / Assistant / Patient / Narrator). We store that
-- as an additive jsonb column on scripts so the whole existing
-- pipeline (critic, captions, slides, diff) — which all key off
-- full_script — is untouched.
--
--   role_blocks shape:
--   [{ "speaker": "Doctor", "text": "...", "direction": "holds x-ray" }]
--
-- full_script stays the canonical plain text (server joins the
-- blocks as "Speaker: text"); role_blocks is read only by the
-- Studio UI. NULL role_blocks == monologue (legacy + non-Studio
-- generation). Run in Supabase SQL Editor after 020.
-- ============================================================

alter table public.scripts
  -- Speaker-labelled rendition of full_script. NULL = monologue.
  add column if not exists role_blocks jsonb,
  -- Which featured/format template produced this script, if any.
  -- Nullable; Studio ideas derive their scaffold from the source
  -- arsenal video on the fly, so this stays null there.
  add column if not exists format_template_id uuid
    references public.script_templates(id) on delete set null;
