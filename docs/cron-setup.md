# Cron setup

Two agents run on a weekly schedule:

| Agent | Path | Schedule (UTC) | What it does |
|---|---|---|---|
| Research | `POST /api/agents/research` | Mon 09:00 | Web-search for trends → `trend_signals` |
| Diff | `POST /api/agents/diff` | Sun 22:00 | Compare shipped Google Docs vs. writer originals → `diff_rules`, optionally `few_shot_library` |

Both routes iterate every clinic when called without a body. Pass `{"clinicId": "..."}` to scope to one.

## Option A — Vercel Cron (default)

`vercel.json` at the repo root already declares both jobs. On Vercel, the cron runner calls each path on schedule. Set a shared secret:

```bash
vercel env add CRON_SECRET
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`. `lib/cron/auth.ts` verifies it. If `CRON_SECRET` is not set, requests are allowed — fine for local dev, not for production.

## Option B — Supabase pg_cron

Use this if you're not deploying to Vercel, or if you want the schedule to live with the database.

Enable the extensions once:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Then schedule the HTTP POST calls:

```sql
SELECT cron.schedule(
  'research-weekly',
  '0 9 * * 1',
  $$
    SELECT net.http_post(
      url := 'https://<your-app>.vercel.app/api/agents/research',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'diff-weekly',
  '0 22 * * 0',
  $$
    SELECT net.http_post(
      url := 'https://<your-app>.vercel.app/api/agents/diff',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Set `app.cron_secret` at the DB level to match your `CRON_SECRET` env var.

## Manual trigger

For debugging, call either route directly:

```bash
curl -s -X POST http://localhost:3000/api/agents/research \
  -H "authorization: Bearer $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"clinicId":"<uuid>"}' | jq
```
