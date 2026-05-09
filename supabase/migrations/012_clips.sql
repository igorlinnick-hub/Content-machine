-- ============================================================
-- Content Machine — Migration 012
-- Doctor video clip cleanup pipeline. Doctor drops mp4 in a
-- Drive Inbox folder; Pax (the new agent) downloads, runs Whisper +
-- ffmpeg silence/filler-word cuts + caption burn-in, uploads
-- artifacts to Drive, posts the link in Telegram.
-- Run in Supabase SQL Editor after 011.
-- ============================================================

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  -- Drive ids — origin file (lives in Inbox until processed) and
  -- the per-clip output folder we create under Cleaned/<date_topic>/
  drive_inbox_file_id text not null,
  drive_inbox_file_name text not null,
  drive_clip_folder_id text,
  status text not null default 'pending'
    check (status in ('pending','processing','cleaned','failed')),
  -- Duration before/after cuts so the operator sees the savings.
  duration_in_sec real,
  duration_out_sec real,
  -- Counts so we can show "trimmed 23 fillers, 18 silences".
  cuts_filler_count int,
  cuts_silence_count int,
  -- Drive ids of the artifacts we wrote.
  cleaned_file_id text,
  transcript_txt_file_id text,
  transcript_srt_file_id text,
  -- Telegram chat that triggered the run (for status updates).
  triggered_chat_id text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_clips_clinic
  on public.clips(clinic_id, created_at desc);

create unique index if not exists ux_clips_inbox_file
  on public.clips(clinic_id, drive_inbox_file_id);

alter table public.clips enable row level security;

drop policy if exists "clinic_isolation_clips" on public.clips;
create policy "clinic_isolation_clips" on public.clips
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);
