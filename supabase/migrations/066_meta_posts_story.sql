-- Direct Meta publishing learns Instagram Stories: kind = 'story' sends the
-- row's single image as media_type STORIES instead of a feed post. A story
-- has no caption (the text is on the picture) and never lands on the grid.

alter table public.meta_posts
  add column if not exists kind text not null default 'feed';

alter table public.meta_posts
  drop constraint if exists meta_posts_kind_check;
alter table public.meta_posts
  add constraint meta_posts_kind_check
  check (kind in ('feed', 'story') and (kind = 'feed' or (network = 'instagram' and video_url is null)));
