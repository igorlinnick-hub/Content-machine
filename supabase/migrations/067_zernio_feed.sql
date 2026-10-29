-- Zernio feeder: X and LinkedIn posts of a brand, by plan (Igor 2026-10-29:
-- "a plan for 2 weeks and a cron, like Instagram"). Zernio holds the schedule
-- itself and has no slot cap, so /api/cron/zernio-feed (ticked daily by
-- pg_cron below) hands it every pending row due within the next 14 days; rows
-- further out wait here, where a plan that is still changing can be edited.
--
-- One row = one post on one channel. A LinkedIn document post carries its PDF
-- in media_urls and the title LinkedIn shows in document_title; a row with
-- document_title but no PDF yet is held back (and reported) instead of going
-- out as plain text.

create table if not exists public.zernio_feed (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  seq             int not null,
  source          text not null,                 -- e.g. 'hiredrop:x-X01'
  channel         text not null check (channel in ('x', 'linkedin')),
  text            text not null,
  media_urls      text[] not null default '{}',  -- public HTTPS (image / PDF)
  document_title  text,                          -- LinkedIn document post
  first_comment   text,                          -- LinkedIn: source link etc.
  due_at          timestamptz not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'scheduled', 'cancelled')),
  zernio_post_id  text,
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinic_id, source)
);

create index if not exists zernio_feed_pending_due_idx
  on public.zernio_feed (clinic_id, due_at) where status = 'pending';

alter table public.zernio_feed enable row level security;
drop policy if exists "clinic_isolation_zernio_feed" on public.zernio_feed;
create policy "clinic_isolation_zernio_feed" on public.zernio_feed
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Daily at 15:00 UTC, before the day's LinkedIn (16:00) and X (17:00) slots.
-- Same x-cron-key as meta-publish / buffer-feed (app_secrets, 060).
select cron.unschedule('zernio-feed')
where exists (select 1 from cron.job where jobname = 'zernio-feed');

select cron.schedule(
  'zernio-feed',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://content-machine-gules.vercel.app/api/cron/zernio-feed',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-key', (select value from public.app_secrets where name = 'meta_publish_cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
