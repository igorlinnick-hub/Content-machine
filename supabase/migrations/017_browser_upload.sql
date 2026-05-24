-- ============================================================
-- Content Machine — Migration 017
-- Browser-side video ingest: doctor drops an mp4 directly into
-- the /arsenal admin UI (drag-and-drop or file picker) instead of
-- pasting a TikTok/IG link. We pre-upload the bytes to Supabase
-- Storage via the existing arsenal-videos bucket, then enqueue a
-- video_ingest_queue row with source_platform='browser_upload'
-- and the storage path in source_url (using a storage:// scheme).
-- The local script-arsenal-ingest skill reads source_platform on
-- pickup — for 'browser_upload' it skips yt-dlp and downloads
-- straight from the public Storage URL.
--
-- Backwards compatible: existing platforms keep working unchanged.
-- Run in Supabase SQL Editor after 016.
-- ============================================================

alter table public.video_ingest_queue
  drop constraint if exists video_ingest_queue_source_platform_check;

alter table public.video_ingest_queue
  add constraint video_ingest_queue_source_platform_check
    check (source_platform in (
      'instagram',
      'youtube',
      'tiktok',
      'twitter',
      'browser_upload',
      'unknown'
    ));
