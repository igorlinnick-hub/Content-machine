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

## 15. TARGET OUTPUT SHAPE (from the marketer — authoritative)

The user pasted this canonical example. **Every post the system produces must conform to this shape on disk + in the slide_sets row.** This is more structured than what the current pipeline emits — see §15.2 below for the delta.

```json
{
  "plan_id": "POST 18",
  "category": "Wellness & Vitality",
  "topic_slug": "erectile-dysfunction",
  "cover": {
    "title": "Erectile Dysfunction",
    "hook": "About half of men 40–70 experience some ED. Most never mention it."
  },
  "slides": [
    {
      "n": 2,
      "heading": "The real cause",
      "intro": "ED is often assumed psychological. The data says otherwise.",
      "bullets": [
        "Endothelial dysfunction — vessel lining underperforms",
        "Reduced nitric oxide — limits widening",
        "Lower arterial blood flow"
      ],
      "close": "PDE-5 inhibitors force vasodilation — they work, but don't fix the cause."
    }
  ],
  "cta": {
    "keyword": "VITALITY",
    "line": "Comment \"VITALITY\" to book a free consultation"
  },
  "caption": "full IG caption + hashtags (988-line if mental-health)",
  "photo_brief": [
    {
      "n": 1,
      "source": "ai",
      "subject": "Native Hawaiian man ~50 contemplative bedroom dusk ocean window",
      "prompt": "Cinematic editorial photo, muted teal+amber, photoreal 35mm"
    },
    {
      "n": 2,
      "source": "stock",
      "subject": "thoughtful mature man",
      "keywords": ["man", "thoughtful", "health"]
    }
  ]
}
```

### 15.1 Field semantics

- **`plan_id`** — stable handle ("POST 18"), human-readable for the marketing roadmap. Maps to a row in some content-plan table (currently `content_plan_topics` may need extending or a new `post_plans` table).
- **`category`** — display label, e.g. "Wellness & Vitality". Maps loosely to `clinic_categories.name` but the example uses a coarser bucket than the current category set.
- **`topic_slug`** — kebab-case identifier used for cache filenames in Drive (`auto-generated/erectile-dysfunction/2.png` etc.).
- **`cover.title`** — slide 1 headline. Mixed case (NOT all-caps — see §15.3 wave variant).
- **`cover.hook`** — sub-line under the title. One specific stat or claim that makes the user keep scrolling. Currently maps to `TypedSlide.subtext` on cover.
- **`slides[n].heading`** — body slide chip/title (currently `TypedSlide.chip`).
- **`slides[n].intro`** — body slide framing sentence above the bullets (no current equivalent — needs new field or repurpose of `subtext`).
- **`slides[n].bullets`** — 2-4 short bullet lines. The CURRENT renderer puts everything into `TypedSlide.text` as one block — bullets need to be rendered as a list.
- **`slides[n].close`** — closing line after the bullets, often the "wait but here's the catch" pivot (compliance-sensitive; reviewer notes which posts need 988 line).
- **`cta.keyword`** — one ALL-CAPS word that triggers the DM bot ("VITALITY"). Marketing uses this with Manychat / native IG comment-triggered DMs.
- **`cta.line`** — full call-to-action sentence. Currently maps to `TypedSlide.text` on cta.
- **`caption`** — full Instagram caption block, including hashtags. **NEW** — current pipeline doesn't emit this, captions are separate / manual. Compliance: include 988 line when topic is mental-health-adjacent.
- **`photo_brief[n].source`** — `'ai'` → call Flux Schnell with `prompt`. `'stock'` → search keywords (Unsplash / Pexels via separate provider, OR fall back to the clinic's curated Drive library before AI). Per-slide decision is made by the planner agent, not auto-magic.
- **`photo_brief[n].subject`** — short human-readable subject line for the picker UI ("thoughtful mature man"). Surfaced in `/visual` PostsWorkspace next to the photo so marketer can override.
- **`photo_brief[n].prompt`** — only present when `source: 'ai'`. Direct Flux prompt.
- **`photo_brief[n].keywords`** — only present when `source: 'stock'`. Search terms for stock provider.

### 15.2 Delta vs current code

| Field | Current | Target | Action |
|---|---|---|---|
| `plan_id` | none | required | add column on `slide_sets` OR new `post_plans` table |
| `category` | `category_id → clinic_categories.name` | display string | usable as-is |
| `topic_slug` | none | required for Drive cache filename | derive from script topic, kebab-case |
| `cover.title` | `TypedSlide.text` (uppercase forced by renderer) | mixed case | make uppercase optional per template_variant |
| `cover.hook` | `TypedSlide.subtext` | same shape ✓ | rename in UI |
| `slides[].heading` | `TypedSlide.chip` ✓ | ✓ | rename in UI |
| `slides[].intro` | none | required | add to `TypedSlide` OR derive from script splitter |
| `slides[].bullets[]` | none — one `text` blob | required | extend `TypedSlide` + renderer needs bullet layout |
| `slides[].close` | none | optional | add to `TypedSlide` |
| `cta.keyword` | none | required | add to slide_sets / scripts row |
| `cta.line` | `TypedSlide.text` ✓ | ✓ | rename in UI |
| `caption` | computed elsewhere via captioner agent | required IN this output | inline captioner call in `/api/posts/generate` |
| `photo_brief[]` | implicit — renderer picks from Drive | explicit per-slide | new field; emits both AI prompt OR stock keywords |
| `photo_brief[].source` | always auto-cycle | `'ai' \| 'stock' \| 'drive'` | planner decides; see §15.4 |

### 15.3 Renderer changes needed

Current `lib/visual/templates.ts` body layout has a single uppercase block of `slide.text`. Target body slide has:

```
┌───── photo background ─────┐
│                            │
│  HEADING                   │ ← chip card with heading
│  intro sentence            │ ← framing line
│                            │
│  • bullet 1                │ ← bulleted list (NEW)
│  • bullet 2                │
│  • bullet 3                │
│                            │
│  close sentence            │ ← pivot line
│                            │
└────────────────────────────┘
```

Body card grows from ~42% of canvas to ~55-65% to fit bullets. Wave variant keeps the curved overlay shape but extends down further.

### 15.4 Photo source decision (`source` field on `photo_brief`)

The planner agent (new or extension of splitter) decides per slide:

- **`source: 'drive'`** — clinic's curated Drive library has a photo tagged for this `topic_slug` and `subject`. Reuse. **Free, instant.**
- **`source: 'ai'`** — abstract concept (neurons, exosomes, peptides, etc.) OR no Drive match. Generate via Flux Schnell. **~$0.003/slide.**
- **`source: 'stock'`** — generic human-centric subject (e.g. "thoughtful mature man") where stock photo provider gives a better, cheaper result than AI. **~$0 if Unsplash, $0.05-0.20 if paid stock.**

Default ordering when planner is unsure: `drive > ai > stock`. The marketer can override per-slide in the picker.

### 15.5 988 line compliance

When `category` matches a mental-health bucket (depression, anxiety, suicide, mood, PTSD, OCD, etc.), the caption MUST end with:

```
If you or someone you know is struggling, call or text 988 — the Suicide & Crisis Lifeline.
```

This is enforced in the captioner agent's system prompt OR a post-processing guard. Hardcoded list of trigger categories in `lib/agents/captioner.ts` (or a new `lib/agents/caption-compliance.ts`).

### 15.6 Migration / schema impact

Two reasonable paths:

**Option A: extend `TypedSlide` in `types/index.ts`**
```ts
export interface TypedSlide {
  kind: SlideKind
  text: string         // legacy — keep for backwards compat
  chip?: string | null
  subtext?: string | null
  // NEW (optional, planner-emitted):
  heading?: string | null      // alias for chip on body slides
  intro?: string | null
  bullets?: string[] | null
  close?: string | null
  photo_brief?: PhotoBrief | null
}
```
No migration needed — slides are already JSONB on `slide_sets.slides`. Renderer reads new fields if present, falls back to old `text` if not.

**Option B: new `post_plans` table + `slide_sets.plan_id FK`**
```sql
create table post_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  plan_handle text not null,         -- "POST 18"
  category text not null,
  topic_slug text not null,
  cover jsonb not null,
  cta jsonb not null,
  caption text,
  photo_brief jsonb not null,
  created_at timestamptz default now()
);
alter table slide_sets add column plan_id uuid references post_plans(id);
```
Heavier, but separates the "planning" artefact from the rendered carousel. Right call when marketer wants to re-render the same plan in different variants.

**Recommend A for now** — ships in days, no migration coordination with the parallel session, retains full backwards compat.

---

## 16. COMPLIANCE GATE (BINDING — must wire into the pipeline)

**Read first:** [CLAUDE.md](CLAUDE.md) ⚖️ COMPLIANCE section + [docs/COMPLIANCE-INTEGRATION.md](docs/COMPLIANCE-INTEGRATION.md) + [docs/compliance-ruleset.md](docs/compliance-ruleset.md) v2.1.

Hawaii Wellness Clinic generates content into a regulated medical space (FDA/FTC + lawsuit exposure). Of their 330 historical IG posts, ~30% crossed a rule (29 REMOVE, 75 REWORD, 165 REVIEW). **Compliance is not optional polish — it gates publication.**

### 16.1 The rule — every generated script/post must pass compliance

This applies to **BOTH** flows:
- **Post pipeline** (this task) — `/api/posts/generate` → text from writer+critic → must be screened.
- **Doctor video script pipeline** — Telegram bot → marek handoff → script returned to doctor → must be screened.

The same compliance gate sits in both flows. The marketer explicitly called this out as a single mechanism applied at the right stage in each pipeline.

### 16.2 Two-layer architecture (Layer A + Layer B)

**Layer A — generate compliant by construction**
- Inject the ruleset summary into `lib/agents/writer.ts` SYSTEM_PROMPT (the writer never produces non-compliant output in the first place).
- Inject a stricter version into `lib/agents/critic.ts` SYSTEM_PROMPT so the critic scores compliance as one of its dimensions and rejects variants that fail.
- Cost: zero extra LLM calls. Just longer prompts. Use prompt caching since these are stable.

**Layer B — gate before publish**
- New module `lib/agents/compliance.ts` runs **after** Critic picks the winner, **before** `splitScriptToSlides` AND before any save / publish path.
- Grades each script as `REMOVE | REWORD | REVIEW | PASS`. Returns findings array (rule violations + line refs).
- Hard rules:
  - **Block** publication when grade is `REMOVE` or `REWORD`.
  - **Never emit a bare `PASS`** — always include findings (even if empty) and a confidence band.
  - **Never use the words "safe" or "compliant"** in the output — this is a screen, not legal advice.
  - **Never auto-publish a `REMOVE`** — even if marketer clicks publish, the route refuses.
  - **Final sign-off** is the medical director + counsel — the gate produces a structured artefact for them to review, nothing more.

### 16.3 Where in the post pipeline to insert the gate

Updated flow (additions in **bold**):

```
runWriter(...)                     // Layer A: writer prompt has compliance rules
  ↓
runCritic(variants)                // Layer A: critic scores compliance + picks winner
  ↓
runCompliance(winner.script)       // ← Layer B: new gate. Returns { grade, findings, ... }
  ↓
  if grade in ['REMOVE', 'REWORD']  → block, return 409 with findings, don't render
  ↓
splitScriptToSlides(winner.script) // (unchanged)
  ↓
fillPhotos(slides, clinic, style)  // (the photo-fill work from §7-8)
  ↓
renderSlides(slides, style)        // (unchanged)
  ↓
createSlideSet({ ..., compliance: { grade, findings, model, run_at } })
  // ← persist the gate result alongside the slide_set so the medical
  //   director / counsel can review later. Add a column on slide_sets.
```

### 16.4 Where in the doctor video script pipeline to insert the gate

Telegram bot → marek handoff → `lib/team/handoffs/marek.ts` (or wherever the script returns to the doctor). Same `runCompliance(script)` call between Critic and "send to doctor". If grade is REMOVE/REWORD, marek replies in TG with the findings instead of the script, asks the doctor to reword or escalate.

### 16.5 Schema additions

```sql
-- migration after the parallel session's 020-022 lands:
alter table slide_sets
  add column compliance jsonb;  -- { grade, findings[], model, run_at }

alter table script_finals  -- doctor-facing scripts table
  add column compliance jsonb;
```

JSONB so the gate's output evolves without further migrations.

### 16.6 What NOT to do

- ❌ Do not paraphrase the ruleset in code comments — read it from `docs/compliance-ruleset.md`. When the ruleset version bumps (v2.1 → v2.2), only the file changes, no code edit needed.
- ❌ Do not let the gate auto-rewrite REWORD findings. The marketer / medical director must see the suggested change explicitly.
- ❌ Do not log "compliance: PASS" in user-facing messages. Use neutral language like "screen complete — 0 high-priority findings, see report".
- ❌ Do not skip the gate when `ENABLE_LLM_AGENTS=false` (subscription mode). Subscription mode means **no new posts generate at all**, so the gate is dormant by definition. Don't add a backdoor.

### 16.7 Reading order to wire this in

Before writing any code:
1. [CLAUDE.md](CLAUDE.md) ⚖️ COMPLIANCE section
2. [docs/COMPLIANCE-INTEGRATION.md](docs/COMPLIANCE-INTEGRATION.md) — the binding integration brief
3. [docs/compliance-ruleset.md](docs/compliance-ruleset.md) — the machine-readable rules (v2.1)
4. [docs/compliance-playbook.md](docs/compliance-playbook.md) — plain-language do/don't

Then:
5. `lib/agents/writer.ts` — where to inject Layer A
6. `lib/agents/critic.ts` — where to inject Layer A
7. `lib/team/handoffs/marek.ts` — where to call Layer B for doctor scripts

---

## 17. CONTENT PLAN — June 2026 (authoritative few-shot source)

**Read:** [docs/content-plan-2026-06.md](docs/content-plan-2026-06.md)

The marketer delivered a 24-post, source-checked editorial plan for HWC. **This is the authoritative reference for:**
- Few-shot library seeds — feed all 24 posts into `few_shot_library` table.
- Structural conventions the writer MUST follow (cover → mechanism → analogy → evidence → application → CTA stack).
- Compliance baseline (FDA dates, hedged language, sourced claims, forbidden constructions).
- CTA keyword map (24 deterministic mappings, see §3 of the content plan doc).

### 17.1 Universal slide arc — every carousel must produce this

```
Slide 1  Cover                       — title (mixed case) + hook ("Swipe →")
Slide 2  Mechanism / The real cause  — heading + intro + bullets[3] + close
Slide 3  Gap slide (optional, 14/24) — why standard care misses it
Slide 4  Think of it this way        — sticky analogy (23 of 24 posts have it)
Slide 5  What the data shows         — evidence payoff (lands AFTER analogy)
Slide 6  Who it's for / candidacy    — bullets + close
Slide 7  Session / protocol          — bullets
Slide 8  Why it's underused          — optional
Final    CTA stack                   — Follow + Comment "<KEYWORD>" + Book
```

**Exception:** Post 20 (suicidal ideation) deliberately skips the analogy and uses a stripped CTA (only Comment + 988 line, no Follow / Book). The writer must detect mental-health-acute topics and switch to this template variant.

### 17.2 Per-bucket category map

```
Mental Health      → 9 posts (01-03, 13-15, 19-21) — 988 line mandatory
Pain & Joint       → 4 posts (07-09, 22)
Wellness & Vitality→ 7 posts (04-06, 16-18, 24)
Weight Loss        → 4 posts (10-12, 23)
```

Maps to `category` field in target output shape (§15).

### 17.3 What the writer SYSTEM_PROMPT must add

```
You are writing for Hawaii Wellness Clinic. EVERY carousel you produce MUST:

1. Follow the slide arc in HANDOFF-POSTS.md §17.1.
2. Include a "Think of it this way" analogy slide UNLESS topic is in the
   mental-health-acute list (suicidal ideation, self-harm).
3. End with the 3-line CTA stack (Follow + Comment "<KEYWORD>" + Book).
   Generate the keyword from the post topic — single ALL-CAPS word.
4. NEVER claim a therapy "treats / cures / reverses / regenerates / restores"
   anything. Use "supports", "may help", "studies report", "pilot data shows".
5. NEVER state "FDA-approved" unless literally true for that exact product.
   See docs/content-plan-2026-06.md §4.2 for the verified FDA date list.
6. NEVER offer exosomes as a service.
7. ALWAYS label evidence stage: "Phase 2", "pilot studies", "preclinical",
   "investigational, not FDA-approved", "emerging therapy".
8. ALWAYS produce a Sources block as separate metadata, NEVER in the caption.
9. For Mental Health bucket captions, ALWAYS end with the 988 crisis line.

Reference the 4 canonical posts in docs/content-plan-2026-06.md §5 as in-prompt
few-shot examples. These represent the gold standard.
```

This prompt sits in `lib/agents/writer.ts` SYSTEM_PROMPT. Same prompt-cache strategy as current — stable across calls, ephemeral cache.

### 17.4 Seed strategy — `few_shot_library`

A new module `lib/seeds/content-plan-2026-06.ts` exposes:
```ts
export async function seedContentPlanFewShot(clinicId: string): Promise<{ inserted: number; skipped: number }>
```

Called idempotently on every `/api/posts/generate` request (cheap: SELECT count first, INSERT only if count is below 24). Or called once via an admin button on `/clinics/[id]`. Inserts the 24 posts as `script_text` rows with `score = 10`, `topic = <slug>`, `active = true`.

### 17.5 How this composes with §15 (target shape) and §16 (compliance gate)

```
Writer + this prompt          → target shape JSON (§15) — emits all the right
                                fields including photo_brief
        ↓
Critic                        → scores; compliance is one dimension
        ↓
Compliance gate (§16)         → REMOVE / REWORD / REVIEW / PASS
        ↓
splitScriptToSlides           → existing splitter, slightly extended for new
                                bullets / close / heading fields
        ↓
photoFiller (§7 photo-fill)   → fills photo_brief into actual Drive photos
                                or Flux generations
        ↓
renderSlides                  → existing Puppeteer renderer + new bullet layout
        ↓
createSlideSet                → persisted with compliance JSONB + plan_id
```

Three layers compose cleanly. No circular dependencies. Each new module has one job. Implementation order:
1. **First** — wire compliance gate (§16). Without it nothing should publish.
2. **Second** — extend writer with content-plan few-shot + structural prompt (§17.3).
3. **Third** — extend renderer for bullets layout (§15.3).
4. **Fourth** — wire photo-fill (§7, photoFiller orchestrator).
5. **Fifth** — extend captioner to emit caption inline with the post.

Compliance must come first because every other change adds new ways to produce non-compliant output.

---

## 18. COUNCIL CORRECTIONS (2026-06-09) — applied after full-stack audit

A final audit caught 4 gaps in §§15-17. Apply BEFORE Session 1 implementation. Each is short, focused, and replaces / extends a specific section.

### 18.1 Mental-health-acute trigger list (extends §17.1)

§17.1 says "Post 20 deliberately skips the analogy" but never defines the trigger. Add to `lib/agents/writer.ts`:

```ts
// Hardcoded list — easier to maintain than a model decision.
// When the topic / hook string matches ANY of these, the writer
// switches to the stripped template (no analogy, no Follow/Book stack,
// only Comment + 988 line).
export const MENTAL_HEALTH_ACUTE_TRIGGERS = [
  'suicid', 'self-harm', 'self harm', 'crisis', 'acute ideation',
  'ideation', '988', 'lifeline',
]

export function isMentalHealthAcute(topic: string, hook?: string): boolean {
  const blob = `${topic} ${hook ?? ''}`.toLowerCase()
  return MENTAL_HEALTH_ACUTE_TRIGGERS.some((t) => blob.includes(t))
}
```

The writer reads this BEFORE choosing the slide arc.

### 18.2 CTA keyword map — lives in code, not just markdown (extends §17.3)

Content plan §3 has the 24 deterministic post → keyword map. Don't leave it in markdown — the writer must do an exact lookup before falling back to generation. Add:

```ts
// lib/seeds/cta-keywords.ts
export const CTA_KEYWORD_BY_TOPIC_SLUG: Record<string, string> = {
  'ketamine-depression': 'RESET',
  'antidepressant-failure': 'MECHANISM',
  'standard-treatment-ceiling': 'SIGNS',
  'hormones-after-40': 'HORMONES',
  'testosterone-not-muscle': 'TESTOSTERONE',
  'nad-cellular-currency': 'NAD',
  'painkillers-dont-heal-joints': 'JOINT',
  'prp-blood-medicine': 'PRP',
  'shockwave-pain': 'SHOCKWAVE',
  'diets-fail-biology': 'METABOLISM',
  'semaglutide-not-scale': 'SEMAGLUTIDE',
  'glp1-30-days': 'GLP1',
  'sgb-ptsd': 'SGB',
  'anxiety-not-head': 'ANXIETY',
  'tms-magnetic-fields': 'TMS',
  'peptides-what-they-are': 'PEPTIDE',
  'iv-drips-marketing': 'IV',
  'erectile-dysfunction': 'VITALITY',
  'spravato-not-ketamine': 'SPRAVATO',
  'suicidal-thoughts': 'SUPPORT', // special — no Follow/Book
  'talk-someone-not-enough': 'CLARITY',
  'a2m-cartilage': 'A2M',
  'retatrutide-next-step': 'RETATRUTIDE',
  'standard-blood-panel-gaps': 'PROGRAM',
}

export function suggestCtaKeyword(topicSlug: string): string | null {
  return CTA_KEYWORD_BY_TOPIC_SLUG[topicSlug] ?? null
}
```

Writer logic: `suggestCtaKeyword(slug) ?? llmGenerateKeyword(topic)`.

### 18.3 Gap slide trigger (extends §17.1 — fills the 14/24 vs 10/24 ambiguity)

14 of 24 posts include a "why standard care misses this" slide; 10 skip. The signal in the plan: gap slide appears when the post explains an **insurance / protocol / time-constraint reason** standard medicine doesn't reach for the better option. Add this to the splitter's prompt:

```
Include a "gap slide" (slide 3) when the post explains WHY standard care
skips this option — examples from the content plan:
  • "doesn't fit a 15-minute visit" (post 01)
  • "the standard pathway is optimized for the next prescription" (post 02)
  • "needs a centrifuge and image guidance — more setup than a script" (post 08)
  • "TMS needs a device, a course of sessions and trained staff" (post 15)
  • "SGB sits on the border of pain medicine and psychiatry" (post 13)

Skip the gap slide when the post is a how-to / 30-days-on-X timeline
(posts 12, 24), a multi-pathway overview (posts 14, 21), or sensitive
acute (post 20). When unsure, skip — a 6-slide post beats a forced 8.
```

### 18.4 Sources go to metadata, NEVER to caption (correction to §15.1 + §17.3)

§15.1 lists `caption` and `Sources` as separate, but the writer prompt in §17.3 doesn't say sources must be excluded from caption. Council flagged this. Explicit rule:

> The writer emits a separate `sources[]` field on the post-plan JSON. Sources NEVER appear in the `caption` field. The medical director reviews `sources[]`; the public sees only `caption`. The captioner module must never concatenate them.

Update `caption` shape:
```ts
caption: {
  body: string                    // public IG caption text
  hashtags: string[]              // appended at the end
  crisis_line: string | null      // mandatory for Mental Health bucket
}
sources: Array<{                  // INTERNAL — never published
  claim: string
  citation: string
}>
```

---

## 19. NEW MODULE — `lib/agents/factCheck.ts` (NOT in any prior section)

Council found §16 compliance gate does NOT catch the 7 fact corrections the content plan v2 fixed. The gate enforces tone + claims policy, but a writer regression could still emit:
- TMS anxious-depression year = 2020 (correct: 2021)
- SELECT trial missing "established cardiovascular disease"
- Spravato monotherapy 2025 missing
- Retatrutide without "investigational" / "not FDA-approved"
- ED stat "over 40" (correct: "52% of men aged 40-70")
- NAD+ with unsourced percentages

These slip past the LLM-graded compliance call because they're fact errors, not tone violations. Add a **deterministic regex pre-pass** keyed off content plan §4.2:

```ts
// lib/agents/factCheck.ts
//
// Runs BEFORE lib/agents/compliance.ts. Pure regex, no LLM, no
// network. Catches fact regressions cheaply — anything that fails
// here jumps straight to REWORD on the gate's verdict.

export interface FactFinding {
  rule: string                 // 'FACT_TMS_DATE' etc.
  severity: 'reword' | 'review'
  matched: string              // the exact substring that triggered
  correction: string           // human-readable correction
}

export function factCheckScript(script: string): FactFinding[] {
  const findings: FactFinding[] = []
  const text = script.toLowerCase()

  // FACT_TMS_DATE — anxious depression year must be 2021
  if (/tms[^.]*anxious[^.]*depression[^.]*202[0]/i.test(script)) {
    findings.push({
      rule: 'FACT_TMS_DATE',
      severity: 'reword',
      matched: 'TMS anxious depression 2020',
      correction: 'TMS clearance for anxious depression is 2021, not 2020',
    })
  }

  // FACT_SELECT_ESTABLISHED — SELECT must mention "established CVD"
  if (/SELECT\s+(trial|study)/i.test(script) &&
      !/established\s+cardiovascular/i.test(script)) {
    findings.push({
      rule: 'FACT_SELECT_ESTABLISHED',
      severity: 'reword',
      matched: 'SELECT trial mentioned without "established CVD" criterion',
      correction: 'SELECT enrolled 17,604 adults with ESTABLISHED cardiovascular disease',
    })
  }

  // FACT_RETATRUTIDE_INVESTIGATIONAL — must be hedged
  if (/retatrutide/i.test(script) &&
      !/(investigational|not\s+FDA[- ]approved|phase\s*[23])/i.test(script)) {
    findings.push({
      rule: 'FACT_RETATRUTIDE_INVESTIGATIONAL',
      severity: 'reword',
      matched: 'retatrutide mentioned without "investigational" hedge',
      correction: 'Retatrutide is investigational, not FDA-approved as of 2026',
    })
  }

  // FACT_SPRAVATO_MONOTHERAPY — when discussing monotherapy/2025
  if (/spravato/i.test(script) &&
      /monotherapy/i.test(script) &&
      !/2025/.test(script)) {
    findings.push({
      rule: 'FACT_SPRAVATO_MONOTHERAPY',
      severity: 'review',
      matched: 'Spravato monotherapy discussed without 2025 date',
      correction: 'Spravato monotherapy clearance is Jan 2025',
    })
  }

  // FACT_ED_STAT — must use "40-70" range not "over 40"
  if (/erectile\s+dysfunction/i.test(script) &&
      /over\s+40/i.test(script) &&
      !/40\s*[-–]\s*70/i.test(script)) {
    findings.push({
      rule: 'FACT_ED_STAT',
      severity: 'reword',
      matched: '"over 40" framing for ED prevalence',
      correction: 'Correct stat: ~52% of men aged 40-70 (Massachusetts Male Aging Study)',
    })
  }

  // FACT_NAD_PERCENT — naked NAD+ decline % requires source
  if (/NAD\+?/i.test(script) &&
      /\d{2}%\s+by\s+(age\s+)?\d{2}/i.test(script)) {
    findings.push({
      rule: 'FACT_NAD_PERCENT',
      severity: 'review',
      matched: 'specific NAD+ decline percentage',
      correction: 'NAD+ specific decline percentages are not well-established — use "declines with age, human trials ongoing"',
    })
  }

  // FACT_EXOSOMES_SERVICE — never offer exosomes as a service
  if (/(we\s+offer|our\s+exosome|exosome\s+(therapy|treatment|protocol))/i.test(script)) {
    findings.push({
      rule: 'FACT_EXOSOMES_SERVICE',
      severity: 'reword',
      matched: 'exosomes presented as offered service',
      correction: 'FDA: no approved exosome products. Never list exosomes as a service offered.',
    })
  }

  return findings
}
```

Plumbing: `factCheckScript(script)` runs at the top of `runCompliance` (§16.3) before any LLM call. If any `severity: 'reword'` finding fires, the compliance result is auto-graded `REWORD` and the findings are appended — no Opus call needed. Saves ~$0.005 per blocked post.

Extend the fact-check rule list whenever the content plan publishes new corrections. Each rule is 4-6 lines; no plumbing changes.

---

## 20. IMPLEMENTATION ORDER (final, council-approved)

Replaces the order in §17.5 with the council's corrections from §18 / §19.

**Session 1 (one focused session, ~1000 LOC, doable in one sitting):**

```
Step 1   migration 023_compliance_and_plan_id.sql
         alter table slide_sets add column compliance jsonb;
         alter table slide_sets add column plan_id text;
         alter table script_finals add column compliance jsonb;

Step 2   lib/agents/factCheck.ts                  (deterministic regex)
Step 3   lib/agents/compliance.ts                 (LLM gate, uses factCheck output)
Step 4   lib/seeds/cta-keywords.ts                (post → keyword map)
Step 5   lib/seeds/content-plan-2026-06.ts        (24 posts as data)
Step 6   lib/agents/writer.ts                     (prompt + few-shot wiring + acute trigger)
Step 7   lib/agents/critic.ts                     (compliance dimension)
Step 8   types/index.ts                           (TypedSlide.bullets/intro/close/heading + PostPlan + ComplianceResult)
Step 9   lib/visual/templates.ts                  (bullet layout for body slide)
Step 10  app/api/posts/generate/route.ts          (wire: writer → critic → factCheck → compliance → splitter → existing renderer)
Step 11  tsc → commit → push

Defer to Session 2:
  - planner agent emitting photo_brief
  - lib/stock/unsplash.ts
  - lib/visual/photoFiller.ts re-scope as resolver
  - lib/replicate/generateSlidePhoto.ts wire-up
  - per-slide AI/stock/Drive branching
```

photoFiller stays at current behavior (cycle Drive folder, navy fallback) for Session 1. Marketer gets:
- ✅ Compliant carousels (fact-checked + LLM-graded)
- ✅ Correct slide arc (cover → mechanism → analogy → evidence → CTA stack)
- ✅ Bullets rendered properly
- ✅ Deterministic CTA keywords on the 24 plan topics
- ⚠️ Photos still cycle from Drive (auto-fill from Flux is Session 2)

This is the right MVP. Don't chase the planner agent in Session 1 — it'll bleed into 1500 LOC and 4 new modules.

---

## 22. FINAL ARCHITECTURE — three generation paths + Canva-bot downstream (2026-06-09)

**The marketer clarified the system boundary.** This supersedes assumptions in §7-8 (photo-fill) and §15.3 (renderer bullet layout) — those are no longer Content Machine's job.

### 22.1 Boundary of responsibility

```
┌─ Content Machine (this repo) ─────────────┐  ┌─ Canva bot (separate repo) ─────┐
│                                            │  │                                 │
│  • Script generation (writer + critic)     │  │  • Pulls ready_for_canva rows   │
│  • Compliance gate (factCheck + LLM)       │──▶  from slide_sets+scripts via    │
│  • Content-plan rotation (cron)            │  │    service key                  │
│  • Persisted target-shape JSON             │  │  • Assembles carousels IN Canva │
│  • Status: pending → ready_for_canva       │  │  • Picks photos in Canva        │
│  • In-app preview renderer (existing)      │  │  • Outputs draft for manual     │
│                                            │  │    approval                     │
└────────────────────────────────────────────┘  └─────────────────────────────────┘
```

**Content Machine produces:** maximally polished, locked-template, fact-checked, compliance-gated **scripts + structured slide data + photo briefs** (the target shape JSON from §15).

**Canva bot consumes:** that data, picks photos in Canva, lays out the carousel using Canva templates. **Photo-fill is NOT Content Machine's job anymore** — drop the §7-8 photo-fill plan and §15.3 bullet layout work.

### 22.2 Three generation paths — all write ONE `ready_for_canva` row

```
Path 1: CRON                  Path 2: Canva-bot trigger     Path 3: marketer in UI
  /api/cron/scheduled-post      POST /api/posts/generate      /visual PostsWorkspace
  (Mon/Wed/Fri 09:00 HST)       (Bearer SERVICE_TOKEN)        (admin session)
       │                              │                              │
       └──────────────────┬───────────┴───────────────┬──────────────┘
                          ▼                           ▼
              ┌────────────────────────────────────────────────────┐
              │  shared pipeline (one function):                    │
              │    runWriter → runCritic → factCheck → compliance   │
              │    → if PASS → splitter → persist to slide_sets     │
              │                  with status='ready_for_canva'      │
              │    → if REWORD/REMOVE → status='blocked', findings  │
              │                  stored, marketer sees in UI        │
              └────────────────────────────────────────────────────┘
                          ▼
                  slide_sets row written
                          ▼
              Canva-bot polls / reacts → builds carousel in Canva
```

**Key invariant:** all three paths call the same `generatePostPlan(input)` library function. Only the auth wrapper differs. Cron uses `CRON_SECRET`, Canva bot uses `SERVICE_TOKEN` (new), marketer uses Supabase admin cookie.

### 22.3 `slide_sets.status` extended

Current values: `'pending' | 'rendered' | 'exported'`.

Add: `'ready_for_canva' | 'blocked' | 'in_canva' | 'published'`.

Lifecycle:
- `pending` — generate request received, writer/critic running
- `blocked` — compliance gate returned REMOVE or REWORD. Findings stored in `compliance` JSONB. Canva bot ignores. Marketer fixes in UI.
- `ready_for_canva` — compliance PASS. Canva bot eligible to pull.
- `in_canva` — Canva bot started assembling. (Optional — Canva bot can write this back via the same service token.)
- `published` — final state after manual approval + IG publish. Optional — can stay out of scope.
- `rendered` / `exported` — legacy, kept for backwards compat.

Migration:
```sql
-- migration 023 (or whatever number after parallel session lands)
-- No schema change — status is text. Just document the extended vocabulary.
-- Optional: add a CHECK constraint.
alter table slide_sets
  drop constraint if exists slide_sets_status_check;
alter table slide_sets
  add constraint slide_sets_status_check
  check (status in ('pending', 'rendered', 'exported', 'blocked', 'ready_for_canva', 'in_canva', 'published'));
```

### 22.4 Cron: scheduled post generation

**New endpoint:** `app/api/cron/scheduled-post/route.ts`

**Schedule:** Vercel cron `0 19 1,3,5 * *` (Mon/Wed/Fri 19:00 UTC = 09:00 HST). Add to `vercel.json`:

```json
{
  "path": "/api/cron/scheduled-post",
  "schedule": "0 19 * * 1,3,5"
}
```

**Auth:** standard Vercel cron — `Authorization: Bearer ${CRON_SECRET}`. Already in env.

**Logic:**
```ts
// app/api/cron/scheduled-post/route.ts
export async function POST(req: Request) {
  // 1. Verify CRON_SECRET
  // 2. For each clinic with active content-plan rotation:
  //    a. SELECT next plan_id WHERE status NOT IN ('ready_for_canva','in_canva','published')
  //       ordered by plan_position. (One row per clinic per cron tick.)
  //    b. Call generatePostPlan({ clinicId, planId })
  //    c. Pipeline runs as in §22.2; status written by the pipeline.
  // 3. Return { generated: N, blocked: M, skipped: K }
}
```

The plan rotation lives in `content_plan_topics` (already exists) extended with `plan_handle text` (e.g. "POST 01") and `cycle_position int` (1-24). Or use a new `post_plans` table per §15.6 Option B — that's the cleaner separation if marketer wants to re-render the same plan in different style variants later.

**Recommend now:** extend `content_plan_topics` with `plan_handle` + `cycle_position` (minimal change). Migrate to `post_plans` table when re-rendering becomes a real workflow.

### 22.5 Canva-bot trigger endpoint

**Endpoint:** existing `POST /api/posts/generate` extended to accept service-token auth.

**New auth path:** `Authorization: Bearer ${SERVICE_TOKEN}` (new env var). When present, bypass `resolveAccess()` and operate as a service caller.

```ts
// in app/api/posts/generate/route.ts
async function authorize(req: Request): Promise<{ kind: 'admin' | 'service'; clinicId?: string }> {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (token && token === process.env.SERVICE_TOKEN) {
      return { kind: 'service' }
    }
  }
  const access = await resolveAccess()
  if (access?.role === 'admin') return { kind: 'admin' }
  return null as never
}
```

Request body extends:
```ts
interface Body {
  clinicId?: string
  topic?: string
  topicId?: string         // existing
  planId?: string          // NEW — pick from rotation by plan_handle (e.g. "POST 18")
  template_variant?: 'classic' | 'wave'
  // ... existing fields
}
```

The Canva bot calls:
```
POST /api/posts/generate
Authorization: Bearer ${SERVICE_TOKEN}
{ "clinicId": "...", "planId": "POST 18" }
```

Returns the same `{ slide_set_id, slides, previews, ... }` shape as the admin path. Canva bot then polls `GET /api/posts/${slide_set_id}` (also service-token enabled) for full target-shape JSON.

### 22.6 New env var

Add to Vercel **Production + Preview**:
```
SERVICE_TOKEN=<generate a 32+ char random>
```

Document this in `docs/COMPLIANCE-INTEGRATION.md` so the Canva-bot operator has it.

### 22.7 Canva-bot read path

The Canva bot does NOT call any generation endpoint when polling for "what's ready". It can:
- **Option A:** poll `GET /api/posts/ready-for-canva?clinicId=...` (NEW endpoint). Returns array of `{ slide_set_id, plan_handle, topic, created_at }`. Service-token auth.
- **Option B:** read `slide_sets` directly via Supabase service role key (the Canva bot operator already has this). Faster, no extra endpoint.

**Recommend Option A** — Content Machine controls the contract. If we change the underlying schema, the Canva bot doesn't break.

### 22.8 What Content Machine STOPS building

- ❌ Photo-fill orchestrator (`lib/visual/photoFiller.ts`, `lib/replicate/generateSlidePhoto.ts` wire-up) — Canva picks photos
- ❌ Bullet layout in Puppeteer renderer (§15.3) — Canva renders
- ❌ Drive upload (`uploadPhotoBytes`) — only needed for AI fill into Drive, which we're not doing
- ❌ Stock photo provider (Unsplash adapter) — Canva handles

The in-app preview renderer (`lib/visual/renderer.ts` + classic/wave templates) **stays** — marketer still previews in `/visual` before status flips to `ready_for_canva`. But it's no longer the publication path.

### 22.9 What Content Machine MUST build (Session 1, revised)

```
Session 1 — script factory + cron + Canva-bot trigger:
  Step 1   migration 023 — slide_sets status vocab + content_plan_topics.plan_handle + cycle_position + slide_sets.compliance + plan_id
  Step 2   lib/agents/factCheck.ts                  (§19, deterministic regex)
  Step 3   lib/agents/compliance.ts                 (§16, LLM gate)
  Step 4   lib/seeds/cta-keywords.ts                (§18.2)
  Step 5   lib/seeds/content-plan-2026-06.ts        (24 posts as data → few_shot_library + content_plan_topics)
  Step 6   lib/agents/writer.ts                     (§17.3 prompt + §18.1 acute trigger + few-shot wiring)
  Step 7   lib/agents/critic.ts                     (compliance dimension)
  Step 8   lib/posts/pipeline.ts                    (NEW — shared generatePostPlan(input) used by all 3 paths)
  Step 9   app/api/posts/generate/route.ts          (refactor: extract pipeline → lib/posts/pipeline.ts; add SERVICE_TOKEN auth; accept planId)
  Step 10  app/api/cron/scheduled-post/route.ts     (NEW — cron entry point)
  Step 11  app/api/posts/ready-for-canva/route.ts   (NEW — Canva-bot poll endpoint)
  Step 12  vercel.json                              (add Mon/Wed/Fri cron entry)
  Step 13  SERVICE_TOKEN env var on Vercel + documented in COMPLIANCE-INTEGRATION.md
  Step 14  tsc → commit → push

Defer to Session 2 (if ever — Canva bot may make these unnecessary):
  - Puppeteer bullet layout
  - Drive auto-fill via Flux
  - Stock provider integration
```

**~900 LOC, one focused session.** Photo-fill and renderer bullet changes drop out. Script-factory-plus-cron is the actual deliverable.

---

## 23. Open questions for the user

If the incoming bot needs to ask:

1. **Naming convention for `auto-generated/{niche}/` subfolder in Drive** — does marketer want one subfolder per clinic, or one global, or per category? **Recommend:** `{clinic_root}/auto-generated/{topic_slug}/{n}.png` so cache key is just `topic_slug + slide_n`.
2. **Failure mode when Flux is down / Replicate rate-limited** — fall back to navy fallback (current behaviour)? or fall back to a placeholder texture? or fail the whole generate request? **Recommend:** navy fallback + log warning, never fail the generate request.
3. **Should we update `slide_sets.drive_folder_id` to point to the auto-generated subfolder** after auto-fill, so the existing PhotoPicker indexes them on the next open? **Recommend:** no — keep `drive_folder_id` pointing at the clinic's curated category folder. Auto-generated photos go into a parallel subfolder that the picker also lists.
4. **Stock photo provider** — Unsplash free API, Pexels, or paid stock? Affects `source: 'stock'` rows of `photo_brief`. **Recommend:** start with Unsplash (free, decent quality, no per-image cost). Add Pexels as fallback. Paid stock only when marketer asks.
5. **Planner agent vs splitter extension** — emit `photo_brief[]` from a new agent OR extend the splitter? **Recommend:** extend splitter with a second pass over the produced slides — same model call can emit chip/text/bullets/photo_brief in one shot. Avoids a third LLM call per post.
6. **988 line list of trigger categories** — exhaustive list? **Recommend:** `['depression', 'anxiety', 'suicide', 'suicidal', 'self-harm', 'ptsd', 'ocd', 'mood', 'mental-health', 'bipolar']`. Easy to extend.

None of these are blockers — sane defaults exist for each. Just call out the choice in the commit message.
