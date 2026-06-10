# Studio — film board for the clinic team (2026-06-08)

New per-clinic feature: `/studio` page (doctor-accessible, not admin-gated) — a
horizontal swipeable board of video-idea columns for the clinic film team.

## Shape
Each column pins one high-reach reference video from `script_arsenal`:
account + view badge → inline-playable video → structure schema (beats) →
collapsed template (scaffold) → role-assigned idea (who-says-what). Two buttons:
"Regenerate idea" (same video, new idea, excludes current hook) and
"Change video" (next pool video ≥200k views, fresh schema/template/idea).

## Key reuse / patterns
- Examples live INSIDE Content Machine (arsenal-videos bucket), NOT Drive —
  inline playback + the ingest analysis is what feeds the AI. Drive is only for
  staff's filmed OUTPUT (Clips Inbox).
- Writer gained `pinnedFormat` + role mode (`SYSTEM_PROMPT_ROLES` suffix so base
  prompt cache still hits). Canonical rule: model returns `role_blocks`, server
  joins them into `full_script` so the two can't diverge — downstream
  critic/caption/slide untouched.
- Slot state persisted in `studio_slots` so video only changes on button press.
- Semi-auto trends: cron `/api/cron/scan-trends` SEEDS the queue from
  `trend_sources` (account/hashtag listing URLs, `discovered_via=trend_scan:`),
  the local skill does the yt-dlp pull (Vercel can't), admin approves in
  /arsenal. Gated by `ENABLE_TREND_SCAN` (separate from `ENABLE_LLM_AGENTS`).

## Migrations / env to apply
- 020_studio (view_count+author_handle on arsenal, studio_slots),
  021_script_role_blocks (scripts.role_blocks+format_template_id),
  022_trend_sources (+ video_ingest_queue.discovered_via).
- Env: `ENABLE_TREND_SCAN=true` to turn on the weekly scan;
  `STAFF_PORTAL_URL` for the PDF guide QR.

## Gotcha
Local node_modules had drifted — `proxy-agent` (transitive of puppeteer) missing,
broke ALL puppeteer scripts. Fix: `npm install proxy-agent --no-save`. The PDF
render script (`scripts/render-staff-guide.mjs`) drives system Chrome via
puppeteer-core to sidestep the bundled-browser path entirely.
