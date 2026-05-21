# 2026-05-20 — Arsenal back-office + visual analysis (Phase A)

## What

Layered three things on top of yesterday's arsenal ingest pipeline:

1. **Visual analysis** of every ingested reference video — keyframes via ffmpeg scene-detect, multimodal Claude in the local skill reads them, writes `visual_notes` (storyboard + pacing + b-roll pattern + hook visual) to `script_arsenal`.
2. **Admin-only back-office** at `/app/arsenal/` with two tabs — Arsenal (cards with inline `<video>`, hooks/structure/visual blocks, refine chat per row) and Templates (manage the script_templates table). Doctor visits → redirect to /dashboard.
3. **Refinement loop.** Operator types "разверни про b-roll подробнее" → `pending_refine_note` set → skill polls `/api/arsenal/refine-queue` → applies → `/api/arsenal/[id]/apply-refinement` clears the note + appends to `refine_history`. UI polls only while `pending_refine_note` is non-null.

Also added an **"Add reference video"** URL-paste form in the UI, so Igor doesn't have to switch to Telegram. Same code path: `detectIngestUrl` + `enqueueIngest`. And a **"Save as template"** button that snapshots an arsenal row's beat structure into the existing `script_templates` table via a tiny bridge.

## Why this shape

- **Video file storage = Supabase Storage `arsenal-videos`** (public bucket, 200MB cap). Matches the existing `clinic-videos` pattern; the dashboard `<video>` element plays straight from `publicUrl()`. No Drive, no streaming layer.
- **Heavy lifting still local.** Vercel `/api/arsenal/draft` accepts mp4 + thumb *paths* (bucket keys) — never the bytes. The skill PUTs via signed upload URL it gets from `/api/arsenal/upload-url`. Keeps us off the 250MB Vercel function ceiling and means the visual pass can use scene-detect ffmpeg + multimodal Claude in-session (subscription-paid).
- **Refine is poll-on-demand, not realtime.** Idle cards don't tap the API; only an expanded card with a `pending_refine_note` polls every 8s. Stops when the skill clears the note.
- **Templates view is the missing surface,** not a new concept. `script_templates` already exists with 6 seeded scaffolds and the writer already consumes it. We just gave it a UI so Igor can see/disable/delete entries — same toggle UX as arsenal styles.

## Schema (migration 015)

`alter table script_arsenal add column` ×6: `visual_notes jsonb`, `video_storage_path text`, `thumbnail_storage_path text`, `pending_refine_note text`, `refined_at timestamptz`, `refine_history jsonb`. Plus `insert into storage.buckets` for `arsenal-videos`.

## New surface

| File | What |
|---|---|
| `supabase/migrations/015_arsenal_visual.sql` | columns + bucket |
| `lib/arsenal/store.ts` | extended interfaces + `loadArsenalRow`, `setPendingRefineNote`, `loadRefineQueue`, `applyRefinement`, `setVideoStorage`, `setVisualNotes` |
| `lib/arsenal/storage.ts` | `createUploadTargets` (signed PUT URLs), `publicUrl`, `deleteArsenalObjects` |
| `lib/arsenal/template-bridge.ts` | `arsenalToScaffold` + `saveArsenalAsTemplate` |
| `app/api/arsenal/ingest-url/route.ts` | POST (admin-cookie) — URL → queue |
| `app/api/arsenal/[id]/route.ts` | GET single row + derived public URLs |
| `app/api/arsenal/[id]/refine/route.ts` | POST refinement note |
| `app/api/arsenal/[id]/toggle/route.ts` | POST {action: confirm|on|off|delete} |
| `app/api/arsenal/[id]/save-as-template/route.ts` | POST → script_templates insert |
| `app/api/arsenal/refine-queue/route.ts` | GET pending refines (secret-gated, skill polls) |
| `app/api/arsenal/[id]/apply-refinement/route.ts` | POST from skill (secret-gated) |
| `app/api/arsenal/upload-url/route.ts` | GET signed upload URLs (secret-gated) |
| `app/api/arsenal/draft/route.ts` | extended: accepts `visual_notes`, storage paths |
| `app/arsenal/page.tsx` | admin page, two-tab layout |
| `app/arsenal/components/{ArsenalWorkspace,ArsenalCard,RefineChat,IngestUrlForm,TemplatesWorkspace}.tsx` | UI |
| `app/dashboard/page.tsx` | adds `Arsenal →` link (admin only) |
| `~/.claude/skills/script-arsenal-ingest/SKILL.md` | phases 4.5 (visual), 4.6 (upload), 5 (refinement loop) |

## Gotchas + decisions worth remembering

- The supabase types insert overload trips on object-literal exact-checking for JSONB columns — same fix as yesterday: cast through `Json` (`as unknown as Json`) not through the row's inferred field type.
- `pending_refine_note` has a partial index so the skill's poll query is cheap even with thousands of arsenal rows.
- `refine_history` is capped at 20 entries client-side to avoid runaway row growth.
- "Save as template" is one-way — the template is a frozen snapshot. Operator can keep refining the arsenal entry; the template won't update. To resync: drop + re-save.
- Admin pages have no per-clinic auth — admin sees all clinics, switches via `?clinicId=`. Doctor pages are pinned to `access.clinicId`. Same pattern as `/visual`.

## Pre-deploy

- [ ] Apply migration 015 in Supabase SQL Editor (after 014 is applied)
- [ ] Confirm `arsenal-videos` bucket created (migration does it via `insert into storage.buckets`; if your SQL Editor lacks `storage` perms, create manually + set public)
- [ ] No new env vars (reuses `TELEGRAM_WEBHOOK_SECRET` for skill→API auth; `ADMIN_KEY` already gates `/arsenal`)
- [ ] `npx tsc --noEmit` clean
- [ ] Smoke: paste IG reel in `/arsenal` URL form → run skill locally → expect card with video + visual_notes → click Refine → type a note → run skill again → expect updated card + history entry → Save as template → switch to Templates tab → expect new row
