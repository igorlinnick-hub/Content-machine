-- Direct Meta publishing queue (Instagram + Threads through the Graph API,
-- no Buffer). One row = one post on one network at one time. The publisher
-- (app/api/cron/meta-publish) is ticked every 5 minutes by pg_cron (061) and
-- takes rows whose publish_at has come.
--
-- container_id is saved as soon as Meta returns it: a retry first asks Meta
-- whether that container is already PUBLISHED, so a tick that died halfway
-- never posts the same thing twice.

create table if not exists public.meta_posts (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  network       text not null check (network in ('instagram', 'threads')),
  caption       text not null default '',
  image_urls    text[] not null default '{}',   -- public URLs; JPEG for Instagram
  publish_at    timestamptz not null,
  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  attempts      int not null default 0,
  last_error    text,
  claimed_at    timestamptz,
  container_id  text,
  media_id      text,
  permalink     text,
  published_at  timestamptz,
  source        text,            -- free label, e.g. 'hiredrop:P11'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meta_posts_due_idx on public.meta_posts (publish_at) where status in ('scheduled', 'publishing');
create index if not exists meta_posts_clinic_idx on public.meta_posts (clinic_id, publish_at);
-- The same post can't be queued twice for the same network.
create unique index if not exists meta_posts_source_uq on public.meta_posts (clinic_id, network, source) where source is not null;

alter table public.meta_posts enable row level security;
drop policy if exists "clinic_isolation_meta_posts" on public.meta_posts;
create policy "clinic_isolation_meta_posts" on public.meta_posts
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Secrets the database itself needs (the pg_cron tick authenticates to the
-- app with one). RLS on and no policy: only the service role can read it.
create table if not exists public.app_secrets (
  name        text primary key,
  value       text not null,
  created_at  timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

insert into public.app_secrets (name, value)
values ('meta_publish_cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;
