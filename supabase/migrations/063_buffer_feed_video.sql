-- Buffer feeder learns video (TikTok + Instagram Reels).
--
-- A row now names its own channels: carousels stay ['instagram'], a video goes
-- to ['tiktok'] or ['tiktok', 'instagram'] (Instagram then posts it as a Reel).
-- The feeder keeps order per channel, so a full TikTok queue never holds back
-- an Instagram carousel and the other way round.
--
-- video_url / cover_url must be public URLs Buffer can fetch (Supabase public
-- bucket). ai_generated sets TikTok's / Instagram's "AI-generated" label —
-- TikTok requires it for realistic AI video.

alter table public.buffer_feed
  add column if not exists channels      text[]  not null default '{instagram}',
  add column if not exists video_url     text,
  add column if not exists cover_url     text,
  add column if not exists ai_generated  boolean not null default false;

alter table public.buffer_feed
  drop constraint if exists buffer_feed_channels_check;
alter table public.buffer_feed
  add constraint buffer_feed_channels_check
  check (channels <> '{}' and channels <@ array['instagram', 'threads', 'tiktok']::text[]);

-- TikTok takes video only; anything else needs media of some kind.
alter table public.buffer_feed
  drop constraint if exists buffer_feed_media_check;
alter table public.buffer_feed
  add constraint buffer_feed_media_check
  check (
    (not ('tiktok' = any(channels)) or video_url is not null)
    and (video_url is not null or cardinality(image_urls) > 0 or channels = '{threads}')
  );

-- The feeder hands out free slots in due order.
create index if not exists buffer_feed_pending_due_idx
  on public.buffer_feed (clinic_id, due_at, seq) where status = 'pending';
