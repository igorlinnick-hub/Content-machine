-- Web-push subscriptions for "clip ready" notifications
-- (HANDOFF §22.2 п.9 — канал выбран 2026-07-06: web push + in-app,
-- Telegram убран). One row per browser/device that granted
-- notification permission; endpoint is globally unique per the
-- Push API spec.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_clinic_idx
  on push_subscriptions(clinic_id);
