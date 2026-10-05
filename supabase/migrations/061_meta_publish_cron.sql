-- Ticks the Meta publisher every 5 minutes. Vercel cron can't do this on the
-- Hobby plan (once a day at most, and not on the minute), so the database
-- calls the route itself through pg_net. Run AFTER the route is deployed.
--
-- The route checks x-cron-key against app_secrets.meta_publish_cron (060).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('meta-publish')
where exists (select 1 from cron.job where jobname = 'meta-publish');

select cron.schedule(
  'meta-publish',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://content-machine-gules.vercel.app/api/cron/meta-publish',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-key', (select value from public.app_secrets where name = 'meta_publish_cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
