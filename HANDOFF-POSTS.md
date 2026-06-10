# HANDOFF — Post Generation + Photo Pipeline

**Snapshot date:** 2026-06-09
**Live HEAD on prod:** `780de8f` (dual-mode picker + human batch-day message)
**Audience:** any AI / engineer picking up this work cold.

---

## 1. What the user wants (end goal)

Marketer hits **Generate** in `/visual` → 2-3 min later receives a **finished Instagram carousel (5-6 PNG slides, 1080×1350)** with **photos already baked into body/CTA slides**. Marketer can Download → post to IG. **No manual upload-to-Drive step.** If a body slide says "exosomes for brain health", that slide must render with a relevant photo (real or AI-generated), not a navy fallback.

User is a **marketer**, not a developer. Web app `/dashboard`, `/visual`, `/lab`, `/arsenal`, `/clinics`, `/visual/compare` is for the marketing team. Doctors only talk to a Telegram bot (notes → scripts).

---

## 2. Tech stack

- **Next.js 14** App Router on **Vercel** (Hobby plan)
- **Supabase** Postgres + Auth (per-doctor cookie + admin tokens)
- **Anthropic** SDK — 8 agents in `lib/agents/`: writer, critic, captioner, analyst, slide-fixer, research, diff, video-prompter, **photo-indexer**, **photo-matcher**. All funnel through `lib/agents/base.ts` `callAgentJSON` / `callAgentVisionJSON` which gates on `ENABLE_LLM_AGENTS=true`.
- **Replicate** — `lib/replicate/`. Image Lab models: `flux-schnell` ($0.003/img), `flux-1.1-pro` ($0.04), `sdxl-lightning` ($0.0019). Video: Seedance 2.0.
- **Puppeteer + @sparticuz/chromium** — `lib/visual/renderer.ts`. Serverless headless PNG generation at 1080×1350.
- **Google Drive** — `lib/google/drive.ts`. Service account JWT auth. `getPhotosFromFolder`, `getPhotoBytes`, `getPhotoDataUrl`. **No `uploadPhotoBytes` yet** — this is the next thing to add.

---

## 3. Post generation pipeline — current architecture

### Entry point
`POST /api/posts/generate` → `app/api/posts/generate/route.ts`

### Flow
```
Body { clinicId, topic, note?, length?, template_variant?: 'classic'|'wave' }
  ↓
loadSharedContext(clinicId)        // clinic profile + few-shot + diff rules + style template
  ↓
ensureDefaultCategories(clinicId)  // seeds clinic_categories rows on first run
  ↓
matchCategory(topic, categories)   // string-similarity match → folder_id hint
  ↓
runWriter({ topicHint, variantCount: 3, lengthTarget })   // → 3 script variants
  ↓
runCritic(variants)                // scores; winner = highest total
  ↓
splitScriptToSlides(winner.script) // → TypedSlide[] (cover/body/cta)
  ↓
loadPhotoUrlsForSlideSet(slideSetId, slides, style)
  // ← THE GAP IS HERE.
  // Cycles photos from the matched category's Drive folder.
  // If folder empty → returns array of nulls → renderer falls back
  // to brand navy on body/cta. Cover never gets a photo (by design).
  ↓
renderSlides(slides, style)        // Puppeteer → Buffer[]
  ↓
createSlideSet({ slides, previews, ... })  // saves slide_sets row + base64 data URLs for inline preview
  ↓
Response { slide_set_id, slides, previews, ... }
```

### Slide types
`types/index.ts` line 132+:
```ts
export type SlideKind = 'cover' | 'body' | 'cta'
export interface TypedSlide {
  kind: SlideKind
  text: string                 // headline | body | action line
  chip?: string | null         // eyebrow / chip
  subtext?: string | null      // subhead | small line
}
```

### Style variants
`VisualStyle.template_variant: 'classic' | 'wave'` (added in commit `31d2272`).
- **classic** = HWC navy + sky gradient + uppercase. Matches Canva ref `DAHKMvQjpc4` (TMS).
- **wave** = solid brand bg + mixed case + curved card. Matches Canva ref `DAHK2poX3PY` (ED).

Per-post variant is selected via dropdown in PostsWorkspace, passed in `body.template_variant`, folded into `style` for that one generation call.

---

## 4. Photo flow — current (the rough edge)

### Read path: `lib/visual/photos.ts:loadPhotoUrlsForSlideSet`
```
1. resolveEffectiveFolderId(slideSetId)
   = slide_sets.drive_folder_id ?? clinic_categories.drive_folder_id ?? null
2. If no folderId → return [null, null, ...]
3. getPhotoOverrides(slideSetId)
   = JSONB map { "1": "fileId", "2": null, ... } from slide_sets.photo_overrides
4. getPhotosFromFolder(folderId) → Drive listing
5. For each slide:
     cover → null (no photo)
     else  → overrides[i] ?? photos[i % photos.length].id
6. getPhotoDataUrl(id) for each → base64 data URL for puppeteer
```

### The gap user is angry about
If the matched category's Drive folder is **empty or sparse**, step 4 returns `[]` and body/cta slides render with brand navy. **No auto-generation step exists.** Marketer sees navy fallback and assumes the system is broken.

### Smart picker (already shipped, works)
`app/visual/components/PhotoPicker.tsx` modal opens from "📷 Change photo" button on each body/cta slide in `SlideEditor`. Pre-recommendation flow:
- POST `/api/visual/photo-recommend` → returns `picks[]` (AI top 5) + `candidates[]` (all Drive photos with descriptions) + `reason` (one of `null | 'llm_disabled' | 'no_photos_indexed' | 'migration_019_required' | 'photo_index_error'`).
- POST `/api/visual/photo-index` → describes new Drive photos via Claude Haiku Vision, writes to `photo_index` table (migration 019). Loops in batches of 8 with progress bar.
- POST `/api/visual/photo-override` → writes `slide_sets.photo_overrides[slideIndex] = fileId`. Pure DB, no LLM.
- GET `/api/visual/photo-thumb/[fileId]` → streams Drive image (admin-gated, no clinic check).

Marketer's complaint: this only **helps after the fact**. They want photos baked in **at generation time**.

---

## 5. What works (verified by user 2026-06-08 on prod)

✅ Generate produces a post (text quality OK)
✅ Wave/Classic style dropdown applies the right variant
✅ Cover slide renders correctly (just text, no photo by design)
✅ Smart picker opens, lists Drive photos, manual swap works
✅ Kill-switch dual-mode: subscription mode shows "AI suggestions paused" banner; full mode shows recommendations.

## 6. What does NOT work / the blocker

❌ **Body/CTA slides render with navy fallback** when the category's Drive folder is empty or doesn't exist. Marketer hits Generate, gets a post that **looks broken** even though the text is fine.

❌ Image Lab `/lab` exists (commit `30cc2c3`) but is **a standalone tool**. Marketer must manually prompt → download PNG → upload to Drive folder. Multiple steps, easy to forget. **Not wired into post generation.**

❌ No `uploadPhotoBytes` helper in `lib/google/drive.ts` yet — need to add for the auto-fill pipeline to write generated photos back to Drive.

---

## 7. The next task — auto-photo on post generation (council-approved plan)

Decided architecture (option **C: hybrid cycle-then-fill**):

> Default to existing Drive photos when folder has ≥3 hits. When count is below threshold, fill gaps with Flux Schnell using slide-aware prompts. Save generated photos to Drive `auto-generated/{niche}/` subfolder so subsequent posts reuse them via content-hash cache.

### 4 new modules (modular, no monolith)

1. **`lib/visual/photoPrompts.ts`** — pure function, slide + brand → Flux prompt. Already started (file exists, not committed). Routes abstract concepts (cells, neurons, peptides) through 3D-render template; everything else through editorial-photo template.
2. **`lib/replicate/generateSlidePhoto.ts`** — thin Flux Schnell wrapper, returns raw Buffer + cost estimate. Already started (file exists, not committed).
3. **`lib/google/drive.ts`** — extend with `uploadPhotoBytes(folderId, name, bytes, mime)`. **In-progress edit but reverted.** `Readable` from `node:stream` is the SDK shape. Service account already has `https://www.googleapis.com/auth/drive` scope.
4. **`lib/visual/photoFiller.ts`** — orchestrator. Decides per-slide: reuse Drive photo, reuse cached generated photo (hash match), or call generator. Returns enriched slide-set ready for renderer.

### Wire-in
`app/api/posts/generate/route.ts` — single `await fillPhotos(slides, clinic, style)` call between splitter and renderer. **Zero logic in the route.**

### Cost ceiling
~$0.40/month for marketer doing 20 posts/week, mostly because content-hash cache means repeat topics reuse photos. Well under the $5/month cap. Replicate token is `REPLICATE_API_TOKEN` (Vercel env, already set).

### What to deliberately NOT do (per council)
- ❌ No auto-tagging of generated photos
- ❌ No vision-indexing of generated photos (they'll get indexed on the next normal picker cycle)
- ❌ No "self-improving photo library"
- ❌ No background job queue — synchronous in the generate route is fine (adds ~5-10s)
- ❌ No bulk seeder ritual per clinic

---

## 8. Files already on disk but NOT committed

Both came from the in-progress effort that just got paused:

- `lib/visual/photoPrompts.ts` — **complete**, pure function, includes `buildSlidePhotoPrompt` + `slidePromptCacheKey` (SHA-256 truncated to 16 hex).
- `lib/replicate/generateSlidePhoto.ts` — **complete**, fetches Replicate URL → returns Buffer.

What's still needed to finish:
1. Add `uploadPhotoBytes` to `lib/google/drive.ts` (signature in council notes below).
2. Build `lib/visual/photoFiller.ts` orchestrator.
3. One-line wire-in in `app/api/posts/generate/route.ts`.
4. `tsc --noEmit` → commit → push.

### `uploadPhotoBytes` signature (from council)
```ts
export async function uploadPhotoBytes(
  folderId: string, name: string, bytes: Buffer, mime = 'image/png'
): Promise<{ id: string; webContentLink: string }> {
  const drive = driveClient()
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType: mime },
    media: { mimeType: mime, body: Readable.from(bytes) },
    fields: 'id,webContentLink',
    supportsAllDrives: true,
  })
  return { id: res.data.id!, webContentLink: res.data.webContentLink ?? '' }
}
```

Confirm clinic Drive folder is shared with the SA email (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) as Editor before testing.

---

## 9. Database state

Applied to prod (Supabase):
- `019_photo_index_and_overrides.sql` — applied 2026-06-04. Creates `photo_index` table (vision descriptions per Drive file) + `slide_sets.photo_overrides` JSONB column.

Migrations on disk but **not yet applied** in prod (these are from a parallel session, NOT this task — don't touch):
- `020_studio.sql`
- `021_script_role_blocks.sql`
- `022_trend_sources.sql`

Relevant tables for this task:
- `slide_sets` — Row has `id, clinic_id, script_id, slides JSONB, style_template JSONB, drive_folder_id, category_id, photo_overrides JSONB, status, created_at`.
- `clinic_categories` — Row has `id, clinic_id, slug, name, emoji, position, triggers TEXT[], drive_folder_id, cta_template, created_at`. **`drive_folder_id` may be NULL** on many rows — this is part of the gap (no folder → no photos → navy fallback).
- `clinics` — Row has `id, name, niche, services TEXT[], audience, tone, doctor_name, medical_restrictions TEXT[], content_pillars TEXT[], deep_dive_topics TEXT[]`.
- `photo_index` — `(id, clinic_id, drive_folder_id, drive_file_id, file_name, description, tags TEXT[], description_model, indexed_at)`. Unique on `(clinic_id, drive_file_id)`.

---

## 10. Env vars on Vercel (verified 2026-06-08)

Confirmed present in **Production + Preview**:
- `ANTHROPIC_API_KEY` — funded ~$20 of credits
- `REPLICATE_API_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` (root)
- `TELEGRAM_*` (3 vars)
- `CRON_SECRET`, `ADMIN_KEY`
- **`ENABLE_LLM_AGENTS=true`** — just enabled today after marketer topped up Anthropic credits. Was previously undefined → kill-switch was active.

Kill-switch logic: `lib/agents/disabled.ts` — `llmAgentsEnabled()` returns true only when env var equals literal `'true'`. Fail-safe default off. Throws `LLMAgentsDisabledError` from any agent call when off.

---

## 11. Recent commits (chronological)

| commit | what |
|---|---|
| `30cc2c3` | feat(dashboard): Image Lab as 4th tab — Flux + SDXL Lightning standalone tool |
| `31d2272` | visual: wave template variant + /visual/compare self-check page |
| `206326d` | visual: smart photo picker — vision-indexed library + per-slide overrides + style dropdown |
| `58ad637` | visual: photo picker polish — looped indexing with progress + graceful migration fallback + folder helper |
| `473f3cf` | visual: photo picker quality pass — dup exclusion + cancel ref + large-folder cue |
| `780de8f` | visual: dual-mode picker + human batch-day message (current HEAD on prod) |

---

## 12. Parallel session (DO NOT TOUCH)

A separate session is working on `Studio` (film board for video shoots) + `trend_sources` (semi-automated trend discovery via cron). They touched:
- `app/api/cron/scan-trends/`
- `app/api/studio/`
- `app/api/trend-sources/`
- `app/arsenal/components/TrendCuration.tsx`
- `app/studio/`
- `lib/studio/`
- `lib/trends/`
- migrations 020, 021, 022
- `types/index.ts` (added `Row<T>` type helpers + Studio + RoleBlock types)
- `types/supabase.ts` (added studio + trend_sources tables + new role columns on `scripts`)
- `vercel.json` (added cron entry)

**Stay clear of those files.** Photo-fill work is in `lib/visual/`, `lib/replicate/`, `lib/google/`, `app/api/posts/generate/route.ts` — no overlap.

---

## 13. How to verify "done" once shipped

1. `npx tsc --noEmit` clean
2. In `/visual`, set topic e.g. **`Exosomes for brain health`**, style **Classic**, Generate.
3. After 3-5 min, body slides 2, 3, 4 should each show a **photo background** (not navy). Photo should be macro/3D-render style because "exosomes" hits the abstract-keywords path in `photoPrompts.ts`.
4. Generate the **same** topic again → second post should reuse the cached photo from `auto-generated/{niche}/` in Drive (no second Replicate call). Verify by tailing `/api/posts/generate` logs in Vercel — should see "cache hit" log line per slide.
5. Pick another topic e.g. **`Telehealth follow-ups`** (no abstract keyword) → photos should be editorial-style (warm light, soft DoF, clinic aesthetic).
6. Switch style to **Wave** → photo still appears, wave overlay sits on top of it.
7. Cost: 4-5 generations on new topics ≈ $0.015-0.020 total. Verify in Replicate dashboard.

---

## 14. Reading order for an incoming bot

1. This file
2. `app/api/posts/generate/route.ts` (entry point)
3. `lib/visual/photos.ts` (current photo loader — the gap)
4. `lib/visual/photoPrompts.ts` (already written, uncommitted)
5. `lib/replicate/generateSlidePhoto.ts` (already written, uncommitted)
6. `lib/replicate/images.ts` (to understand `generateImages` API surface)
7. `lib/google/drive.ts` (where `uploadPhotoBytes` needs to go)
8. `lib/visual/renderer.ts` (terminal step — what receives the photo URLs)
9. `lib/agents/base.ts` + `lib/agents/disabled.ts` (kill-switch model)

**Do not read** `app/studio/`, `lib/studio/`, `lib/trends/`, migrations 020-022 — that's the parallel session.

---

## 15. Open questions for the user

If the incoming bot needs to ask:

1. **Naming convention for `auto-generated/{niche}/` subfolder in Drive** — does marketer want one subfolder per clinic, or one global, or per category?
2. **Failure mode when Flux is down / Replicate rate-limited** — fall back to navy fallback (current behaviour)? or fall back to a placeholder texture? or fail the whole generate request?
3. **Should we update `slide_sets.drive_folder_id` to point to the auto-generated subfolder** after auto-fill, so the existing PhotoPicker indexes them on the next open?

These are not blockers — sane defaults exist for each. Just call out the choice in the commit message.
