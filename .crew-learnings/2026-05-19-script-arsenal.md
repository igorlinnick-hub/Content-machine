# 2026-05-19 — Script arsenal (Archy) + offline ingest skill

## What

Added a per-clinic *script_arsenal* — a curated collection of reference scripts (Instagram / YouTube / TikTok) that the Writer can borrow style + structure from. Doctor drops a link in Telegram, Archy (📚, new persona) acks and enqueues it. A local Claude Code skill (`script-arsenal-ingest`, lives in `~/.claude/skills/`) polls the queue from Igor's machine, downloads audio with yt-dlp, transcribes + extracts on the Claude Pro subscription (no per-video Replicate spend), and POSTs a draft back. Doctor confirms in TG to flip `is_active=true`.

## Why this shape

- **No Replicate spend per ingest.** The "use only subscription" constraint pushed the heavy work to local Claude Code via skill, mirroring how the medical-broll-pipeline skill already runs offline.
- **Style separation, not blending.** Each ingest is one row with its own `style_label` + `is_active` toggle. Writer's brief renders one block per active style with a hard rule "pick ONE — never mix two arsenal styles in the same script." Doctor can `arsenal off <label>` the moment a style stops working and Writer stops seeing it next turn.
- **Same fire-and-forget pattern as Pax (§20).** Webhook detects URL → DB insert → ack. Heavy compute stays out of the 30s webhook budget. New `/api/arsenal/queue` + `/api/arsenal/draft` endpoints are secret-gated with the same `TELEGRAM_WEBHOOK_SECRET` shared header.

## Schema (migration 014)

- `video_ingest_queue` — pending URLs, unique on `(clinic_id, source_url)` to dedupe paste-twice.
- `script_arsenal` — extracted styles. JSONB for `hooks`, `structure.beats`, `pains` so the extractor can evolve without a migration. `is_active` defaults false (draft); `confirmed_at` set when doctor flips it on.

## New surface

- Persona: Archy (📚) with tools `arsenal_list / confirm / toggle / drop`
- Routes: `/api/arsenal/queue` (GET + POST claim/fail), `/api/arsenal/draft` (POST from skill)
- `lib/arsenal/store.ts` — single source of truth for URL detection + queue + arsenal CRUD
- `lib/team/brief.ts` — `arsenal` array injected per turn (only `is_active=true`, capped at 6)

## Gotchas

- `formatBriefForRouter` renders each style under its own `## Style:` heading with hook patterns + beat sequence + pains. The "never mix" instruction is right above the list — the Haiku router and downstream Marek both see it inside the cached system prompt.
- Reused-URL handling: webhook returns a different ack for completed / awaiting_confirm / pending so the doctor doesn't think they hit dead air.
- Skill SKILL.md prefers in-session Claude multimodal audio reading; falls back to `transcribe_replicate.py` from HWC My Bots if not available. That fallback path costs ~$0.01/min on Replicate — only triggers when the local model can't read audio directly.

## Pre-deploy checklist

- [ ] Apply migration 014 in Supabase SQL Editor
- [ ] No new env vars (reuses `TELEGRAM_WEBHOOK_SECRET`)
- [ ] `npx tsc --noEmit` clean
- [ ] Smoke: doctor pastes IG reel → expect Archy ack with "поставил в очередь"
- [ ] Run `script-arsenal-ingest` skill locally → expect TG ping with extracted summary
- [ ] `arsenal confirm <label>` → row flips `is_active`, next post via Marek references it
