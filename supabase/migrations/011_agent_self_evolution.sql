-- ============================================================
-- Content Machine — Migration 011
-- Adds the agent self-evolution layer: per-clinic, per-agent
-- prompt overrides, preferences, and timestamped learnings from
-- Telegram feedback. The Telegram team router loads these into
-- the brief on every turn so agents can self-update without
-- code edits. Run in Supabase SQL Editor after 010.
-- ============================================================

-- agent_prompts: overridable system-prompt fragment per agent.
-- The router prepends a base persona prompt (from code) and then
-- this row's content. Versioning kept so we can roll back a
-- regressing edit by flipping `active`.
create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  agent_key text not null,
  system_prompt text not null,
  version int not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ux_agent_prompts_active
  on public.agent_prompts(clinic_id, agent_key)
  where active = true;

-- agent_preferences: small typed bag of per-agent settings.
-- Examples: marek.default_length='short', tilda.default_style_template_id='...',
-- ren.paused=true, vex.alert_threshold_usd=50.
create table if not exists public.agent_preferences (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  agent_key text not null,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_agent_preferences
  on public.agent_preferences(clinic_id, agent_key);

-- agent_learnings: timestamped feedback rows, one per
-- correction/rule the user gave the agent over Telegram. Loaded
-- (most recent N, active=true) into the brief so the agent
-- "remembers" the rule without code changes.
create table if not exists public.agent_learnings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  agent_key text not null,
  -- the user message that produced this learning, kept verbatim
  -- so a later session can audit why the rule exists
  user_message text not null,
  -- short summary of what the agent had just done (or attempted)
  agent_action text,
  feedback_kind text not null
    check (feedback_kind in ('positive','negative','correction','rule')),
  -- if feedback_kind='rule', the durable rule extracted from the
  -- user's message. Null for thumbs-up/down.
  rule text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_learnings_agent
  on public.agent_learnings(clinic_id, agent_key, active, created_at desc);

alter table public.agent_prompts enable row level security;
alter table public.agent_preferences enable row level security;
alter table public.agent_learnings enable row level security;

drop policy if exists "clinic_isolation_agent_prompts" on public.agent_prompts;
create policy "clinic_isolation_agent_prompts" on public.agent_prompts
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_agent_preferences" on public.agent_preferences;
create policy "clinic_isolation_agent_preferences" on public.agent_preferences
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_agent_learnings" on public.agent_learnings;
create policy "clinic_isolation_agent_learnings" on public.agent_learnings
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);
