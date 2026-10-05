-- Buffer feeder: posts waiting for a free slot in Buffer. The free Buffer plan
-- holds 10 scheduled posts per channel; a slot frees up each time a post goes
-- out. /api/cron/buffer-feed (ticked daily by pg_cron below) checks the free
-- slots per channel and hands Buffer the next rows in `seq` order, each at its
-- own pre-computed due_at — so a 36-post plan runs itself on the free plan.
--
-- buffer_ids is filled per channel ({instagram: id, threads: id}); a row only
-- becomes `scheduled` when every channel of the brand has an id, so a half-done
-- row never gets a duplicate on the channel that already succeeded.

create table if not exists public.buffer_feed (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  seq            int not null,                 -- posting order
  source         text not null,                -- e.g. 'hiredrop:P11'
  caption        text not null,                -- Instagram (with hashtags)
  threads_text   text,                         -- Threads; null → caption
  threads_topic  text,
  image_urls     text[] not null default '{}',
  due_at         timestamptz not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'scheduled', 'failed', 'cancelled')),
  buffer_ids     jsonb not null default '{}',
  attempts       int not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (clinic_id, source)
);

create index if not exists buffer_feed_pending_idx on public.buffer_feed (clinic_id, seq) where status = 'pending';

alter table public.buffer_feed enable row level security;
drop policy if exists "clinic_isolation_buffer_feed" on public.buffer_feed;
create policy "clinic_isolation_buffer_feed" on public.buffer_feed
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Daily at 16:30 UTC — right after the 16:00 UTC posts go out and free a slot.
-- Uses the same x-cron-key as meta-publish (app_secrets, 060). Run after deploy.
select cron.unschedule('buffer-feed')
where exists (select 1 from cron.job where jobname = 'buffer-feed');

select cron.schedule(
  'buffer-feed',
  '30 16 * * *',
  $$
  select net.http_post(
    url := 'https://content-machine-gules.vercel.app/api/cron/buffer-feed',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-key', (select value from public.app_secrets where name = 'meta_publish_cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
