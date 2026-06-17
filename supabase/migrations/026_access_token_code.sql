-- ============================================================
-- Content Machine — Migration 026
-- Adds memorable access codes to clinic_access_tokens.
--
-- Until now login was: visit /c/<24-char-token>. Marketers / doctors
-- forget where the link lives, so we let admin set a short readable
-- code (e.g. "HWC-TEAM-2026") that they paste/type into the login
-- box on the root page. Codes coexist with tokens — old install links
-- keep working untouched.
--
-- Codes are stored lowercased; uniqueness is enforced across ALL
-- clinics so a typed code can be resolved without a clinic hint.
-- Validation (3-32 chars, [A-Za-z0-9_-]) lives in lib/auth/tokens.ts.
--
-- Run in Supabase SQL Editor after 025.
-- ============================================================

alter table public.clinic_access_tokens
  add column if not exists code text;

create unique index if not exists clinic_access_tokens_code_lower_unique
  on public.clinic_access_tokens (lower(code))
  where code is not null and revoked_at is null;
