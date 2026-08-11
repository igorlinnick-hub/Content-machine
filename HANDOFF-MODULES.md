# HANDOFF — per-module map (READ FIRST)

> **Purpose:** so a fresh session knows how each module *actually works today* —
> especially where the boundary between the Next.js server and a Claude+MCP
> runner sits. The big 133 KB `HANDOFF.md` is history/spec; **this file is the
> current operating truth.** When they disagree, this file wins.
>
> Maintain it: after changing how a module works, update its block here.

---

## ⭐ THE ONE THING PEOPLE FORGET — Canva carousels are built by a Claude+MCP runner, NOT the server

Content Machine (this Next.js app) produces **WORDS**: script + per-slide copy +
a *photo brief*. It does **not** build the finished Canva image and does **not**
generate the photos itself.

The finished carousel is assembled by **Claude + the Canva MCP connector**
(`mcp__claude_ai_Canva__*`) running inside a Claude session — the "runner":
copy an **example/master design** → swap background photos (Flux/Pexels) →
inject text **per line** → export → draft → manual approval → IG.

- **Server-side auto-compose does NOT work and never really did.** The autofill
  orchestrator (`lib/canva/orchestrator.ts`, `POST /v1/autofills`) needs Canva
  **Enterprise brand templates** — the account has **zero** (verified). Over the
  whole DB, exactly **one** post ever got a `render_result` (SGB `DAHM8qYZCTE`,
  hand-built by the runner 2026-06-18). Everything else was never composed.
- **Connect REST API cannot edit design content.** It can create / copy /
  autofill / export only. Scope `design:content:write` = *"Create designs on the
  user's behalf"* (create, not edit). The `find_and_replace_text` / editing-
  transaction ops the runner uses are the **MCP/Apps-SDK connector**, which needs
  **interactive auth** — not available to Vercel or to headless cron.
- **So the workflow is, and always was:** user points at 1–2 example posts →
  Claude (in session, via MCP) copies them and swaps **photos + text only**,
  never touching the design. If you find yourself proposing a "server render" or
  "make the Compose button build it," STOP — that's the wrong path; re-read this.

Spec + step-by-step protocol (source of truth, in the My Bots repo):
`~/Documents/Code Projects/Hawaii Wellness Clinic/My Bots & ALL Projects/docs/projects/canva-posts.md`
and `…/canva-posts-runbook.md`. See also memory `[[project_canva_runner]]`.

---

## Modules

### 1. Content generation — the "words" pipeline
- **Does:** analyst → research → writer → critic → diff over a `SharedContext`,
  then splitter → captioner → **photo-brief** (briefs, not images). Emits one
  PostPlan JSON per post: `{cover, slides[{n,kind,heading,intro,bullets[],close}], cta, photo_brief[], sources}`.
- **Code:** `lib/agents/*`, `lib/supabase/context.ts`, `lib/posts/splitter.ts`,
  `lib/posts/photo-brief.ts`. Entry: `app/api/posts/generate/route.ts` (SSE stream).
- **Models:** Opus critic, Sonnet writer/research, Haiku splitter/analyst/diff/captioner
  (see `[[project_model_mix]]`). Prompt-cached.
- **Gotcha:** kill switch `ENABLE_LLM_AGENTS` — unset = all pay-per-use LLM/Replicate
  paths return "disabled". Arsenal/manual paths stay free (`[[project_kill_switch]]`).

### 2. Compliance (BINDING — FDA/FTC)
- **Does:** gate every script. `factCheck` (regex, $0) → Opus grade vs ruleset v2.1
  → **convergence loop** (`lib/agents/compliance-loop.ts`): rewrite→regrade until
  PASS, ≤3 rounds. Writer is compliant-by-construction (fact rules in its prompt).
- **UI policy (agreed 2026-07-20):** only a hard **REMOVE** surfaces (red "cannot
  publish"). REWORD/REVIEW/PASS are **silent** — findings stay in DB for audit,
  nothing renders. Never print "safe/compliant".
- **Code:** `lib/agents/compliance.ts`, `compliance-loop.ts`, `compliance-rewriter.ts`,
  `factCheck.ts`. Docs: `docs/compliance-ruleset.md`, `docs/COMPLIANCE-INTEGRATION.md`.

### 3. Content plan
- **Does:** structured 8-week plan (`content_plan_weeks` / `content_plan_topics`).
  Per-topic **reroll** (↻) and **+ Add more** regenerate/append a topic that fits
  the week's theme+pillar; **Skip week** hides a week. Topic chips drop from the
  New-Post picker once `status='done'`.
- **Code:** `lib/content-plan/store.ts`, `lib/agents/planner.ts` (`runPlanner`,
  `rerollTopic`), `app/content-plan/*`, `app/api/content-plan/{generate,reroll,add-topic,skip}`.
- **Gotcha:** `store.ts` has a 42703 fallback for the `skipped` column (migration 044).

### 4. Visual / Canva compose  ⭐ (see the ONE THING above)
- **Real path:** Claude + Canva MCP runner. Copy master → Flux/Pexels backgrounds →
  **per-line `find_and_replace_text`** → `commit-editing-transaction` → export PNG →
  write `render_result` + edit URL back → draft → manual approval.
- **BINDING rules (paid for in bugs):** (a) per-line replace, NEVER whole-block
  (collapses bullets); (b) correct master **per category**, never "nearest similar"
  (the `DAHM8qYZCTE` incident: Mental-Health post on ED master → ED text leaked to
  slide 7). Canva API can't add-page → every category needs a ready master.
- **Styles (`slide_sets.canva_style` 1-5) — RE-MAPPED 2026-08-10 (Igor) to the
  finished master templates.** Source of truth = `lib/posts/style-templates.ts`
  (the Templates UI reads it; the canva-compose-runner skill mirrors it). All are
  in the EDITORIAL standard: **body 46pt / title 50pt fixed**, short per-slide
  word budget (body ≤ ~20 words; list ≤ 3-4 items ≤ ~6 words each). Mapping:
  Style 1 → `DAHRSR-KWdA` (diagonal panels, full-bleed photo), Style 2 →
  `DAHQnsEktf0` (rounded teal panels — ✓ checklist + ①②③ path), Style 3 →
  `DAHRSiuJEHQ` (editorial diagonal, dark photo covers), Style 4 →
  `DAHQn_1_j2s` (curved teal/purple panels, medical imagery) — **slots 2/3/4
  rotated 2026-08-11 (Igor, matched against the real covers; the previous
  order pointed each slot at the next style's master)** — Style 5 = Aesthetic
  → `DAHMHS1wLls`
  (full-bleed photo cover, kept for **Made**). Old IDs `DAHRSdnI4ZQ` /
  `DAHQPCOFBDw` / `DAHLnAHrEbA` / `DAHLnF9b328` retired. The runner copies the
  matching master and swaps photos+text only — font/layout inherited.
- **Who sees which style (Igor 2026-08-11):** the registry carries a `niches`
  list per style; `stylesForNiche(clinic.niche)` filters both the style picker
  and the Templates tab. **Aesthetic (5) is `niches: ['aesthetics']` — Made
  only. Dr. Shawn's regenmed clinics never see it.** Every other style is
  universal. `clinics.niche` reaches the UI via `loadClinicList()`.
- **Style previews** (`public/style-previews/<key>.png`, path declared as
  `previewImage` in the registry) are the cover shot each style shows in the
  picker + Templates tab. They are NOT generated — re-export page 1 of the
  master from Canva whenever its cover changes, or the UI shows a stale look.
  A missing file degrades to a grey tile; the style still works.
  **Refreshed 2026-08-11** — Igor exported page 1 of all five masters himself
  (`~/Downloads/HWC/Styles/`) and they were resized to 900px tall into
  `<key>.png`. Re-do it the same way when a master's cover changes.
  **Do NOT identify a master by its Canva design title** — titles are leftovers
  from the post each master was built from and are not maintained: `DAHQn_1_j2s`
  and `DAHMHS1wLls` are BOTH titled "Erectile Dysfunction", and `DAHRSR-KWdA` is
  still titled "Spravato Severe Depression" long after its cover changed. The
  registry's `id` → `canvaDesignId` pair is the only identifier that counts.
- **Photo rules (BINDING, direction v2 — Igor 2026-07-23, in
  `lib/posts/photo-brief.ts`):** aesthetic-first. Default visuals = 3D medical
  renders (organs/molecules/processes, glass-like translucent, teal+amber glow)
  and Hawaii nature — NOT people. People: max 2 slides/post, only outdoor
  Hawaii locations, full figure medium-wide; **cover NEVER a close-up face**.
  `stock` = real-object macro only (devices), never people. `fallback` in old
  briefs: if the example page has a photo background, do NOT keep it (repeats
  across posts) — generate an aesthetic no-people image instead; new briefs
  emit `ai` for those slides. Every ai prompt keeps "dark lower third".
  Visually review every generated image before upload; reject visible AI
  artifacts (hands, waxy skin), close-up-face covers, unbudgeted people.
- Older masters: ED `DAHK2poX3PY`, Peptides `DAHK2t13oEI` (runbook table).
  ⚠️ `lib/canva/templates.ts` is dead code with a different set — ignore.
- **Server bits that DO work:** `POST /api/posts/:id/compose` only sets status /
  writes progress; `/api/posts/:id/canva` mints a **fresh** Canva edit link per
  click (stored edit_url expires ~30d) and back-fills `canva_design_id`. OAuth
  `CANVA_*` in Vercel powers those + copy — **not** compose.
- **Code:** `app/api/posts/[slideSetId]/{compose,canva}/route.ts`,
  `lib/canva/{api,oauth,orchestrator,templates,template-map}.ts` (orchestrator =
  dead autofill path — do not resurrect without Enterprise brand templates).

### 5. Compose UI / status machine
- **Does:** status flow `review → ready_for_canva → in_canva → visuals_ready →
  approved → published`. Live `compose_progress` (migration 045) shows real stages;
  **Stop** = `DELETE /compose`. Recent-Posts list has per-row ✕ delete; collapsible
  sidebar. Compose button trusts the server's returned status (no phantom spinner).
- **Code:** `app/visual/components/PostsWorkspace.tsx`, `lib/posts/status-owners.ts`,
  `lib/posts/pipeline.ts` (`statusFromCompliance`, `autoComposeQueued`).

### 6. Teleprompter + Clips (doctor video)
- **Does:** record in teleprompter → Drive Inbox → Whisper → retake/filler cuts →
  styled captions (presets, migration 038) → Drive Finals. Stop&Save + recorder guard.
- **Code:** `app/teleprompter/*`, `app/clips/*`, `lib/clips/*`, `app/api/cron/clips-inbox`.
  See `[[project_clips_pipeline]]`.

### 7. Studio (talking-head creator product)
- **Does:** TikTok ingest via Apify, format analysis (cover+caption vision), shot
  lists, Trash funnel, storage cleanup. Consumer-facing, transcript-based manual edit.
- **Code:** `app/studio/*`, `lib/studio/*`. See `[[project_studio_pipeline]]`, `[[project_studio_standalone]]`.

### 8. Script Arsenal
- **Does:** doctor drops IG/YT/TikTok link → enqueue → local skill extracts
  hooks/structure/visual → admin UI `/arsenal` → confirm mirrors to `script_templates`.
- **Code:** `app/arsenal/*`, `lib/arsenal/*`, `app/api/arsenal/*`. See `[[project_script_arsenal]]`.

### 9. Scheduling / publishing
- **Does:** schedule posts (`scheduled_posts`, migration 032), Buffer push, cron
  `scheduled-post` (Mon/Wed/Fri 19:00). Notifications = web push (VAPID) + in-app,
  **never Telegram** (removed — `[[project_telegram_team]]`).
- **Code:** `app/scheduler/*`, `app/api/scheduled-posts/*`, `app/api/publish/buffer`,
  `app/api/cron/scheduled-post`, `lib/push/send.ts`.

### 10. Auth / clinic model
- **Does:** per-doctor Supabase cookie auth, admin key, install links, view-as.
  Doctor = thin surface (teleprompter + one-tap); marketing = full back-office
  (`[[project_user_model]]`). White-label per clinic (`[[project_content_machine]]`).
- **Code:** `lib/auth/*`, `app/api/admin/*`, `app/api/auth/*`, `app/c/[token]`, `app/onboarding/*`.

### 11. Infra
- **Supabase** prod ref `pscqjvkuqqmvmcbxdwtu` (org `cxfsnpqcszytidcwrkvm`). Migrations
  through **045** (compose_progress); 044 (skipped) applied. Applying SQL = Igor pastes
  into the dashboard SQL editor (CLI/classifier blocks programmatic DB writes).
- **Vercel** auto-deploys from `main`. Env incl. `CANVA_{CLIENT_ID,CLIENT_SECRET,REFRESH_TOKEN}`
  (integration `OC-AZ-G1--eJ3lK`), `ENABLE_LLM_AGENTS`, Supabase/Google/Replicate/VAPID.
  `vercel --prod` and env writes are classifier-blocked → redeploy via empty commit + push.
- **Storage:** Drive primary + local backup (`[[project_storage_strategy]]`). See `[[project_pending_deploy]]`.
