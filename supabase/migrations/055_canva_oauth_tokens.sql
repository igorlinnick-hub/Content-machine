-- ============================================================
-- Content Machine — Migration 055
-- Durable home for the Canva Connect refresh token.
--
-- WHY: Canva rotates refresh tokens and each one is SINGLE-USE
-- ("Each refresh token can only be used once" —
-- canva.dev/docs/connect/authentication). lib/canva/oauth.ts read
-- CANVA_REFRESH_TOKEN from the env, exchanged it, and threw away the
-- NEW refresh_token that came back in the response. So the value
-- sitting in Vercel env was dead the moment the first refresh ran,
-- and every later refresh 400s until someone re-auths by hand.
--
-- Env vars are read-only at runtime on Vercel, so the rotated token
-- needs a writable home. This table is it. CANVA_REFRESH_TOKEN stays
-- in the env as the one-time SEED for a cold install.
--
-- Single row (id = 'default'): one Canva workspace per deployment.
-- Service role only — no RLS policies, nothing client-side ever
-- touches it.
-- Run in Supabase SQL Editor after 054.
-- ============================================================

create table if not exists public.canva_oauth_tokens (
  id text primary key default 'default',
  -- The live refresh token. Replaced on every successful exchange.
  refresh_token text not null,
  -- Cached access token, so a cold lambda does not have to burn a
  -- refresh token just to mint an edit link.
  access_token text,
  access_expires_at timestamptz,
  rotated_at timestamptz not null default now()
);

alter table public.canva_oauth_tokens enable row level security;

comment on table public.canva_oauth_tokens is
  'Canva Connect OAuth state. Refresh tokens are single-use and rotate on every exchange, so the live one cannot live in a Vercel env var. Seeded once from CANVA_REFRESH_TOKEN.';
