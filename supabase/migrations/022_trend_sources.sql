-- ============================================================
-- Content Machine — Migration 022 (trend sources)
-- Semi-automated trend discovery: marketing curates a list of
-- reference IG/TikTok/YouTube accounts + hashtags. A weekly cron
-- (/api/cron/scan-trends) walks the active sources and enqueues
-- account/hashtag URLs into video_ingest_queue (intent
-- 'ingest_only', tagged via discovered_via). The local
-- script-arsenal-ingest skill does the heavy yt-dlp pull +
-- analysis (Vercel can't run yt-dlp) and posts drafts back; an
-- admin approves them in /arsenal, after which they enter the
-- Studio video pool.
--
-- discovered_via on the queue tags cron-seeded rows so the admin
-- can filter "trend candidates" from doctor-pasted links.
-- Run in Supabase SQL Editor after 021.
-- ============================================================

create table if not exists public.trend_sources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube')),
  -- 'account' = a creator handle to scan; 'hashtag' = a tag feed.
  kind text not null check (kind in ('account', 'hashtag')),
  -- '@drsmith' or '#regenmed' — what to point yt-dlp at.
  handle_or_hashtag text not null,
  active boolean not null default true,
  -- Stamped by the cron each scan so we can space out re-scans.
  last_scanned_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_trend_sources
  on public.trend_sources(clinic_id, platform, kind, handle_or_hashtag);

create index if not exists idx_trend_sources_active
  on public.trend_sources(clinic_id, active)
  where active;

alter table public.trend_sources enable row level security;

drop policy if exists "clinic_isolation_trend_sources" on public.trend_sources;
create policy "clinic_isolation_trend_sources" on public.trend_sources
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- ------------------------------------------------------------

alter table public.video_ingest_queue
  -- Provenance tag for cron-seeded rows, e.g. 'trend_scan:<source_id>'.
  -- Nullable: doctor-pasted / admin-uploaded rows leave it null.
  add column if not exists discovered_via text;
