-- Direct Meta publishing learns video: an Instagram row with video_url goes
-- out as a Reel (media_type REELS). cover_url = optional cover image (JPEG).
-- Meta processes a video for a minute or more, so the publisher may leave the
-- row `scheduled` with its container saved and finish it on a later tick.

alter table public.meta_posts
  add column if not exists video_url text,
  add column if not exists cover_url text;

alter table public.meta_posts
  drop constraint if exists meta_posts_video_ig_check;
alter table public.meta_posts
  add constraint meta_posts_video_ig_check
  check (video_url is null or network = 'instagram');
