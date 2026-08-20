# HANDOFF — per-module map (READ FIRST)

> **Purpose:** so a fresh session knows how each module *actually works today* —
> especially where the boundary between the Next.js server and a Claude+MCP
> runner sits. The big 133 KB `HANDOFF.md` is history/spec; **this file is the
> current operating truth.** When they disagree, this file wins.
>
> Maintain it: after changing how a module works, update its block here.

---

## 🔴 SESSION HANDOFF — 2026-08-13 · branch `feat/aesthetics-manychat` (read first, delete once acted on)

**Continue on branch `feat/aesthetics-manychat`.** Two workstreams: aesthetics (DONE + verified live, ready to merge) and scheduler (blocked on 2 prod actions only Igor can do).

### ✅ Aesthetics ManyChat CTA for Dr. Made — DONE + VERIFIED LIVE
Committed on this branch as **`7a18ab7`** (3 files):
- `lib/seeds/cta-keywords.ts` — new `AESTHETICS_CTA_KEYWORDS` = GLOW, BOTOX, FILLER, LIPS, RENEW, SKIN, YOUTH, PRP, STEMCELL, BEAUTY, ALOHA, MICRO + `keywordPoolForNiche(niche)`. **Must stay in sync with what Igor set in ManyChat.**
- `lib/agents/planner.ts` — planner now **niche-aware**: keyword enum + prompt resolve by `profile.niche` (was hardcoded HWC → Made got nonsensical TMS/PRP keywords). Applies to `runPlanner` + `rerollTopic`.
- `lib/niche/profiles.ts` — aesthetics `ctaMode: 'booking' → 'manychat'` + `manychatKeywordsBlock` (aesthetics pool). Wiring already correct: `buildSystemPosts` (writer, line ~225) + splitter both branch on `ctaMode`.

**Verified LIVE** on a preview deploy (`vercel deploy -e ENABLE_LLM_AGENTS=true`, that deploy only): generated a real Made post ("Lip filler…") → CTA slide came out
`Comment "LIPS" and we'll send you our guide to natural lip augmentation` — keyword from the pool, contextual, 3-line manychat CTA, niche label "medical aesthetics", **no BOOK**. Vercel build green.
- Talking-head SCRIPTS keep a conversational CTA **by design** — the Comment-KEYWORD mechanic is posts-carousel only. Not a bug.

**NEXT ACTION → merge to main:** `git checkout main && git merge feat/aesthetics-manychat` (build green + verified live). NOT merged yet — Igor's call. Prod (`main`) does not have this yet.

### 🔴 Scheduler — NOT working in prod. 2 blockers (both verified live via prod checks):
Scheduler UI/code is ALREADY in prod (committed `42b27dd` on main: calendar redesign, `/api/publish/buffer/health`, honest error surfacing, per-slide regenerate). It has no table + no Buffer, so it 500s / can't publish.
1. **`scheduled_posts` table MISSING in prod** — migration 032 never applied. Prod `GET /api/scheduled-posts` → 500 "Could not find the table 'public.scheduled_posts' in the schema cache" (login/dashboard 200 → DB healthy, only this table absent). **Fix:** paste `supabase/migrations/032_scheduled_posts.sql` into the Supabase SQL editor + **Run**. (Auto-mode classifier blocks Claude from executing prod DB writes — a human clicks Run.)
2. **Buffer NOT connected** — `BUFFER_TOKEN` absent from prod Vercel env. Verified: pulled all 49 prod env vars → ZERO buffer/channel vars under any name; prod health = `token: missing`. Channels existing IN the Buffer account ≠ token in our app's env. **Fix:** set `BUFFER_TOKEN` + `BUFFER_CHANNEL_INSTAGRAM/FACEBOOK/TIKTOK` in Vercel (Igor pastes the token — classifier blocks extracting it from his Safari session). Then `/api/scheduled-posts/*` + cron `scheduled-post` work.

**Re-verified live 2026-08-13 (afternoon, prod `content-machine-gules.vercel.app`, admin session):**
`GET /api/scheduled-posts?clinicId=…` → **500 "Could not find the table 'public.scheduled_posts' in the schema cache"**;
`GET /api/publish/buffer/health` → **`{"token":"missing", all 3 channels "disconnected"}`**. Both blockers still open — nothing changed since the morning entry.

**The несостыковка in this doc — resolved.** §11 Infra said *"Migrations through **045** applied"*, which reads as
"everything up to 045 is in prod" and contradicts blocker 1. The truth: **032 is a HOLE, not a tail.** Later migrations
(033 canva_style … 045 compose_progress) WERE applied; 032 was skipped when it was written and never backfilled.
"Through 045" ≠ "all of 001-045". Fixed the wording in §11.

**Third gap found + FIXED in code this session (no prod access needed):**
- `app/scheduler/page.tsx` — admin with no `?clinicId` got `clinicId = ''`, so `loadPosts()` returned early and the
  scheduler **never loaded a single real post** for an admin arriving from the nav. Every other admin page
  (`/visual`, `/dashboard`) falls back to `clinics[0].id`; scheduler now does the same.
- `SchedulerView.tsx` — the posts fetch swallowed non-OK responses (`if (res.ok)` + empty `catch`). With the table
  missing, the calendar quietly fell back to rendering the **static content plan**, so it *looked* fully scheduled
  while the DB held nothing. Now: red banner with the real API error, and the static-plan fallback is suppressed on
  error/loading. tsc clean.

### ⚠️ Working tree is MIXED across parallel sessions — do NOT blind-commit
Uncommitted files that are NOT aesthetics (belong to other sessions): script-starred feature (`supabase/migrations/046_script_starred.sql`, `app/scripts/`, `RecentScripts.tsx`, `WeekCard.tsx`, `DashBento.tsx`), teleprompter, `lib/supabase/context.ts`, `scripts/canva-runner/run.sh`. PLUS this session's still-uncommitted UI: dashboard **ScriptGenerator → mirror-of-posts** refactor (`app/dashboard/page.tsx` loads `planWeeks`/`currentWeekIndex`), `PostsWorkspace` declutter + all-blue week strip, `SlideEditor` **Guide** button removed (per-slide Regenerate stays). Commit these deliberately, per feature.

### Memory updated this session
`project_pending_deploy.md` (032 missing in prod), `project_content_machine.md` (aesthetics → manychat, Buffer code-only-never-connected).

---

## 🔴 SESSION HANDOFF — 2026-08-19 · Post FORMAT is now a button (delete once acted on)

Igor's ask: the content plan decides **what** we talk about each week; he wants
to decide **how** — educational, useful/shareable tips, "signals worth checking",
myths — with a button, without leaving the plan's logic.

### The catalog — `lib/posts/formats.ts` (NEW, single source of truth)
Nine formats. Three are new: **Educational explainer** (real mechanism + one real
study, plain language), **Practical tips** (top 3-5 doable things — the format
people save and send on), **Warning signs** (signals worth checking, the basic
work-up to ask for by name, when it's urgent). The six that existed keep their
scaffolds verbatim. Each entry carries `name` (stored value), `label` (button),
`hint` (tooltip), `description` + `scaffold` (what the Writer follows).

Compliance is built into the two riskiest scaffolds, not bolted on: Warning signs
says *get checked*, never *you have X*, bans scare stats and self-treatment, and
points at a work-up rather than at the clinic's treatment; Practical tips bans
promised outcomes/timelines and treatment rankings. The Layer-B gate still runs.

Three consumers, one list: `lib/posts/templates.ts` seeds `script_templates` from
it, `lib/agents/planner.ts` rotates it in the 8-week plan, `FormatPicker` renders
it. **Add a format there and it appears in all three.**

### Wiring
- **Seeding now tops up.** `ensureDefaultScriptTemplates` used to bail out if the
  clinic had ANY templates, so existing clinics would never have received the new
  three. It now inserts missing defaults by name and leaves custom/de-activated
  rows alone.
- **Bug fixed on the way (this one mattered):** `getCurrentPlanContext(clinicId,
  topicId)` read `data.format` off a select that never asked for the column — so
  on the 90% path (`planTopicId`) **the planner's format never reached the
  Writer**. All those posts were written with a free-choice template. Fixed in
  `lib/content-plan/store.ts`.
- **Override chain in the Writer:** Studio `pinnedFormat` > `formatOverride` (the
  button) > `planContext.format` > free choice. `formatOverride` is a new
  `runWriter` param; `POST /api/posts/generate` accepts `format` and validates it
  against the catalog (unknown name = ignored, not a 400).
- **Free-choice window widened 6 → 9** in `writer.ts`, or the back-filled formats
  (positions 6-8 for existing clinics) would never be offered ad-hoc.

### UI
- `app/components/FormatPicker.tsx` (NEW) — one chip that opens the catalog with
  hints, plus "Auto — let the writer choose".
- **Content Plan** (`WeekCard`): a format chip on every topic row, next to the
  keyword. Writes through `POST /api/content-plan/set-format` (NEW; admin or the
  owning clinic), optimistic with rollback. A topic reroll keeps a format the
  marketer pinned.
- **New Post** (`PostsWorkspace`): a `Format` control next to Generate. On a plan
  topic it persists to the row; on an ad-hoc topic it rides along in the generate
  call only.

### Not done / next
- Nothing was generated end-to-end with a pinned format — `tsc --noEmit` and
  eslint are clean (the 3 eslint errors in `PostsWorkspace` are pre-existing on
  HEAD), but the first real post through a button is still unproven.
- The planner prompt now asks for format variety per week; the 8-week plans that
  already exist keep whatever formats they were generated with — reroll or
  re-press the buttons if Igor wants the new mix.

## 🔴 SESSION HANDOFF — 2026-08-13 · Canva runner cost + first post on the new writer rules (delete once acted on)

Separate session from the aesthetics/scheduler one above; different files, no overlap.

**Acted on the 2026-08-12 block below: its open task is DONE.** A fresh post was
generated on the queued plan topic ("Retatrutide is the next GLP-1",
slide_set `66f63852`) and composed. Two stale claims in that block: the
watchdog/`compose_progress` bug it lists as open was **already fixed** in
`9bb93d1`, and the "runner env must stay key-free" note now conflicts with an
uncommitted `run.sh` hunk that reads `ANTHROPIC_API_KEY` (env still has no key,
so the code is inert — Igor has not decided subscription vs API key).

### The new writer rules work (first live proof)
`66f63852` is the first post generated after `f36fa0c`. No banned section
labels, cover is a whole phrase, every body slide carries its 6-10-word
takeaway, and `said-before` handed the writer 40 prior headings to avoid.
Text nits Igor has NOT ruled on (do not "fix" silently): slide 5 bullet 2 is
lifted abstract phrasing and over the ~6-word list rule; "~22.5%" carries no
source (compliance asked to attribute or qualify); slide 4 runs 33 words vs the
20-28 band. Compliance = **REVIEW, 5 findings**, all "verify with a human" —
investigational drug, needs the medical director before publishing.

### Compose is a lottery — the finding that matters
The same post composed TWICE, same style: `DAHSM_Jfrd8` (good: Hawaii cover,
right title) and `DAHSNLOxoTo` (worse: no cover photo, title demoted to the
chip, random stock on two slides, headings rewritten differently). **The DB row
points at the worse one.** Run-to-run variance is structural: every compose is a
fresh judgement call by an agent.

### What one compose actually costs (measured, not guessed)
From the 2026-08-12 transcript in
`~/.claude/projects/-Users-igorlinnik-Library-Application-Support-HWC-canva-runner/`:
184 turns · context grows 49.5k → 349k · **37.6M tokens read** ≈ **$18 at API
rates**. It bills Igor's SUBSCRIPTION, so the real cost is his session quota,
not dollars. Drivers: 51 images / 23.5 MB (each page export re-read on every
later turn), and a 49.5k fixed preamble paid on all 184 turns (~9M, a quarter
of the run).

### Runner diet — SHIPPED, NOT YET MEASURED
In `~/.claude/skills/canva-compose-runner/SKILL.md` (user-scope, no repo copy):
- per-page "export + look + iterate" (old §5b tail) removed → build all pages,
  then **one** export and one review, new **§6a**; two exports is the ceiling;
- the scattered re-reads (cover §3, cruft sweep §3, panel verify §5) now point
  at §6a instead of exporting on their own;
- photo review still binding, but on a `sips -Z 640` copy; the **original**
  full-res file is what gets uploaded to Canva;
- **resume**: the copy's design id is written to
  `~/Library/Application Support/HWC/canva-runner/resume/<slide_set_id>` right
  after `copy-design`; §1 step 4 resumes that design instead of rebuilding;
  §6 deletes it on success, transient failure keeps it, content failure clears it.
In `scripts/canva-runner/run.sh`: `caffeinate -ims` wraps `claude -p` (the
laptop slept mid-compose twice today, once one step from done). **Installed
copy is in sync** — but only ever copy it while no compose is running.

### The preamble hunt — MEASURED AND CLOSED (2026-08-19)
Igor's framing was: rules live in MD, read when needed, nothing carried every
turn. Measured against it with a one-token `claude -p … --output-format json`
probe run from the runner's own directory (usage = cache_creation + cache_read):

| session | per-turn preamble |
|---|---|
| as the runner ran it | **49 471** |
| `--allowedTools` narrowed to the 6 Canva tools it really uses | **49 475** |
| no MCP servers at all | 45 842 |
| no MCP **and** no installed-skills listing | 39 161 |

**`--allowedTools` is a permission list — it does not change what loads.** That
optimization is dead; do not re-open it. What the numbers did show:
- the listing of ~30 installed skills costs **6.7k tokens on every turn**;
- every MCP server together costs only ~3.6k, so dropping connectors is not worth
  the breakage risk;
- SKILL.md itself was 6.7k, riding every turn from turn 1 anyway.

**Shipped instead (2026-08-19):**
1. **`scripts/canva-runner/photos.py`** — the whole photo loop (Replicate
   sequential with the 11s rate-limit gap + retries, Pexels portrait search,
   clinic `photo_url`, the per-source fallbacks, download, `sips -Z 640` review
   copy, `manifest.json` resume) in ONE process. The model now spends **two
   turns** on photos regardless of slide count: one to run it, one to look at all
   the 640px copies together. Re-runs skip what a crashed run already paid for;
   `--slide N --prompt "…"` redoes a single rejected image. Tested live against
   Pexels + Replicate. Note: Pexels 403s urllib's default User-Agent — the script
   sets its own, don't remove it.
2. **`run.sh` runs the compose with `--disable-slash-commands` and feeds SKILL.md
   through `--append-system-prompt-file`** (install.sh copies it to the runner
   dir). Skills-listing cost goes away; the runner's own rules stay. If SKILL.md
   is missing the script falls back to invoking the skill by name, so an old
   install still composes.
3. **SKILL.md §4 rewritten** around photos.py; the duplicated photo-direction
   prose now points at `POST-CRAFT.md §5` instead of repeating it (26.7 KB →
   22.2 KB).

Measured after: **50 218 per turn including the runner's instructions**, versus
~56 200 before (49 471 + SKILL.md loaded at turn 1) — about **6k/turn less**.

### Where the 37.6M actually went — read the transcript, don't guess
`06ce50cf-4769-4dec-baeb-b320db291067.jsonl` in the runner's project dir IS the
184-turn compose (07:24→07:47 on 08-13; summing its per-turn context reproduces
37,617,626 exactly, so the method is sound). What it shows:

- **51 images, but only 18 of them are ours.** 33 came from the Canva MCP itself:
  `edit-design` returns an after-thumbnail on EVERY call (23 calls → 22 images /
  11.5 MB, arriving turns 93-162 and re-read for the rest of the run), and one
  `read-design` that asked for `thumbnails` returned 8 pages / 3.1 MB at turn 65.
- **The photo phase was turns ~30-77** — Replicate polling with `sleep`, Pexels
  curls, downloads, and a separate turn per full-resolution `Read` (those were
  NOT downscaled: 3 images added ~13k tokens at turn 50).
- Removing a mid-run turn is worth ~200k tokens, because every later turn
  re-reads the whole context. Turns, not prefix, are the cost.

Simulated against the real per-turn numbers (drop the turns, drop what they added
from every later turn):

| | turns | tokens |
|---|---|---|
| as it ran | 184 | 37.6M ≈ $18 |
| + `photos.py` | 140 | 22.1M (−41%) |
| + one `edit-design` call per page | 110 | 13.5M (−64%) |
| + the preamble diet above | 110 | 12.8M (−66%) ≈ $6 |

**So the batching rule matters more than everything else shipped today**, and it
is now in SKILL.md §5 as BINDING: one `edit-design` call per PAGE carrying every
operation for that page in the `operations` array (the per-line
`find_and_replace_text` rule is untouched — the operations just travel together),
never look at the returned thumbnail, and never ask `read-design` for
`thumbnails` while building (they are opt-in; the default fields are what you
want). §6 now says `edit-design` with `finalize: "commit"`, which is what the
tool actually takes — `start-/commit-editing-transaction` were stale names.

### photos.py — verified end-to-end on a real brief (before it ever runs live)
Ran it against `66f63852` (the Retatrutide post, 7-slide brief): 3 Flux + 3
Pexels + 1 skip, **0 failures**, ~$0.18 of Replicate. Two things it caught:
- **`source:"fallback"` carries `prompt: null`** — the first version would have
  paid Flux to render the words *"Cover — no photo, keep the template branded
  cover"*. Fallback is a JUDGEMENT (does the brand surface stay, or must the
  donor photo go?), so the script now prints `SKIP n=… — your call` and leaves it
  to the model, which can force it with `--slide 1 --prompt "…"`. An `ai` entry
  with an empty prompt now errors instead of generating garbage.
- Review payload for the whole post: **368 KB across 6 files** (515×640 / 426×640)
  versus **7.8 MB** of full-resolution `Read`s in the measured run. Opened one —
  a clean dark 3D anatomy render, every rejection criterion judgeable at that size.

Pre-flight on the runner is green: launchd agent loaded, no quota cooldown, queue
empty, Replicate 201 (credit), Canva MCP connected. It will pick up the next
`ready_for_canva` row within 2 minutes. **Do not re-run install.sh while a compose
is running.**

### MEASURED ON A REAL COMPOSE (post `34883573`, 2026-08-19 23:44→23:56)
It ran inside the parallel session, not via `run.sh`, so the transcript is
`…-Content-machine/5474a717-….jsonl`, turns 449-545.

| | turns | tokens | wall clock |
|---|---|---|---|
| 08-13, clean runner spawn | 184 | 37.6M ≈ $18 | 23 min |
| projection | 110 | 13.5M | — |
| **08-19, normalised to a clean spawn** | **97** | **9.26M** | **12 min** |

**−75%, better than projected.** Normalised = the compose's own tokens plus the
50 218 preamble a fresh spawn would carry, because this run inherited 314 901
tokens of unrelated context from the session it lived in.

**New operational finding, worth more than it looks:** the same compose read
**34.9M raw** inside that fat session versus 9.3M in a clean spawn — **~4× the
cost for the identical work.** A compose must be left to the poller (fresh
process, ~50k preamble) and never run by hand inside a long working session,
except when debugging.

What the data shows worked: `edit-design` 23 → 10 calls for 7 pages (10 page
thumbnails instead of 22), `read-design` returned no thumbnails at all, and
`photos.py` fetched everything in one call at turn 466 with three `--slide`
redos at 479-490.

Remaining slack: the 10 review images were `Read` **one per turn** (468-476,
491-493) even though §4 says to read them in a single message — worth another
~10 turns if the model is made to comply. Fixes on page 2 took 3 calls (512/515/
518); acceptable.

### In-house renderer — BUILT, PARKED by Igor
`lib/render/{types,shapes,html,fonts,png,store,compose}.ts`,
`lib/render/skins/{index,style3}.ts`, `lib/photos/{pexels,resolve}.ts`,
`app/api/posts/[slideSetId]/render/route.ts`, `scripts/render-preview.mts`,
`assets/fonts/` (Playfair + Inter), `next.config.mjs` tracing entry,
`supabase/migrations/047_post_slides_bucket.sql`. tsc clean. It renders all 7
pages of `66f63852` at 2160×2700 with panel-fit, ✓/①②③ and dividers.
**Igor's verdict: the skin is eyeballed from screenshots — "угадывание", not the
template.** If this is ever revived, derive the tokens from the master
`DAHRSiuJEHQ` via `read-design` (element geometry, fills, font families/sizes)
instead of guessing. Migration 047 is **NOT applied**; nothing writes
`render_preview` until it is. Nothing in the Canva path was touched.

### Environment gotchas found today
- **puppeteer cannot even be imported on this Mac** (node 24 / puppeteer 24):
  `require('puppeteer')` never returns. `scripts/render-preview.mts` therefore
  shells out to the cached `chrome-headless-shell` binary. Production is
  unaffected (Linux lambda + `@sparticuz/chromium`).
- **Canva export URLs expire** (~a day): yesterday's `render_result.outputs[]`
  already 403. So `/visual` can never show a preview of a finished carousel.
- **claude.ai artifact links are private** — Igor's Safari isn't signed in
  there, so he sees "Page not found". Deliver review pages as a local file
  (`~/Desktop/…html`) and open it in a **separate** Safari window by id.
- A local HTML file needs `<meta charset="utf-8">` or Safari renders Russian as
  mojibake.
- Canva **Enterprise** (the only way to get server-side autofill) is quote-only,
  real deals $20-50k/year. Dead end, do not re-explore.

### Uncommitted (nothing was committed 08-13 or 08-19)
From 08-13: `scripts/canva-runner/run.sh` (caffeinate; plus the pre-existing
ANTHROPIC_API_KEY hunk from another session), `next.config.mjs`, everything in
the renderer list above, `assets/fonts/*`.
From 08-19 — runner: `scripts/canva-runner/{photos.py,run.sh,install.sh}` (+ the
user-scope `~/.claude/skills/canva-compose-runner/SKILL.md`, which lives outside
this repo). Formats: `lib/posts/formats.ts`, `app/components/FormatPicker.tsx`,
`app/api/content-plan/set-format/route.ts`, `lib/posts/templates.ts`,
`lib/agents/{planner,writer}.ts`, `lib/content-plan/store.ts`,
`app/api/posts/generate/route.ts`, `app/content-plan/components/WeekCard.tsx`,
`app/visual/components/PostsWorkspace.tsx`.
Plus the other sessions' files listed in the block above. Commit per feature,
deliberately.

---

## 🔴 SESSION HANDOFF — 2026-08-12 (read this first, then delete once acted on)

**Where we are.** Post craft was reworked by hand in Canva, then the rules were
written into code and shipped. Everything below is deployed: `origin/main` =
`f36fa0c`, tsc clean.

**What shipped today (`f36fa0c`)**
- **Waterfall logic** (`lib/agents/writer.ts` + `docs/POST-CRAFT.md` §2a): each
  slide answers the question the previous raised; every body slide ends in a
  6-10-word **takeaway** (8 types listed); no slide repeats another; the cover
  promise must be paid off. Takeaway ≠ the banned antithesis bow.
- **Headings carry the reader's question** (§2b). Banned section labels:
  "What the data shows", "Think of it this way", "What's happening". Only
  "Who it's for" survives. A data-titled slide with no verified number must be
  retitled, not padded.
- **Word budget is a band:** 20-28 words/slide (14-18 body + 6-10 takeaway).
- **`lib/posts/said-before.ts` (new):** anti-repetition guard across posts —
  pulls the last 12 plans' hooks/headings/takeaways, hands the writer a
  do-not-reuse list in USER content (system block stays prompt-cached). Wired
  into `app/api/posts/generate/route.ts`, fail-open.
- **`splitter.ts`** no longer normalises headings back to template phrases and
  carries `close` (the takeaway) verbatim.
- **Style-id fix (this was the "Canva generation problem"):** compose route,
  `pipeline.ts` and `orchestrator.ts` used to clamp `=== 2 ? 2 : 1`, so styles
  **3/4/5 silently composed as Style 1**. All three now go through
  `normalizeStyleId()` / `designIdForStyle()` / `brandTemplateEnvKey()` in
  `lib/posts/style-templates.ts` (the single source of truth, mirrored by the
  runner skill + the Templates tab).
- **UI honesty** (`PostsWorkspace.tsx`): queued state says "Waiting for the
  Canva runner" (not a fake "~2 min"), plus an explicit notice after 3 min.

**Canva connector — settled, do not re-litigate.** The managed `claude.ai Canva`
connector works, in interactive AND headless (`claude -p`). A previous session
wrongly concluded it was missing and told Igor to reconnect it in claude.ai —
that was a misdiagnosis; the real symptoms were (a) the connector flapping
in/out of a *running* agent session (a restart or waiting fixes it; it cannot be
re-scanned from inside an agent), and (b) the laptop sleeping, which stops
launchd ticks. Also from that session: a manually-added CLI Canva entry (removed)
and `ANTHROPIC_API_KEY` briefly written into the runner env (reverted — env is
clean, backup at `env.withkey.bak`). **Runner env must stay key-free** — it runs
on the subscription.

**Live proof.** Row `7663abcb` composed successfully at 21:47 →
`DAHSJ_5Bp6k`, status `visuals_ready`, `render_result.canva_edit_url` written.
Style 2 was requested and Style 2 was built — the style fix is confirmed live.

**⚠️ NOT yet tested: the new writer rules.** That post's *text* was generated
Aug 11, **before** `f36fa0c`, so it still shows the banned "THINK OF IT THIS
WAY" / "WHAT RESEARCH SHOWS" headings and a fragment cover ("WORE OFF").
**Next step: generate ONE fresh post** (the queued plan topic is
"Retatrutide is the next GLP-1") and QC design + text together with Igor. That
is the open task.

**Known small bug to fix when convenient.** The compose watchdog re-queues a
stale `in_canva` row but does **not** clear the old `compose_progress`, so the
UI chip counts from the dead run's timestamp (Igor saw "272M elapsed" on a
compose that had just started). Clear `compose_progress` on requeue in
`scripts/canva-runner/run.sh`.

**Working agreement with Igor.** Do the work autonomously; call him only when
design + text are ready to review together.

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
- **Formats:** the Writer's structural scaffolds are seeded per clinic into
  `script_templates` from `lib/posts/formats.ts`; `ensureDefaultScriptTemplates`
  tops up missing ones by name on every generation.
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
- **Format = the second axis (Igor 2026-08-19).** The plan owns WHAT a week is
  about; `content_plan_topics.format` owns HOW that post is written. Catalog:
  `lib/posts/formats.ts` (9 formats). Buttons: `FormatPicker` on every plan topic
  and in the New Post panel → `POST /api/content-plan/set-format`. Generation
  honours Studio pin > button > plan > free choice.
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

### 6. Teleprompter + Clips (doctor video) — обновлено 2026-07-25
- **Does:** врач в телепромптере: записал → прямая загрузка в Drive (presign→PUT→confirm,
  БЕЗ лимита длины; экран «editor notified», push команде). Админ в `/clips` (admin-only):
  Recordings (скролл/превью/удалить-с-Drive) → **Auto-edit** → Ready videos (плеер в приложении).
  Пайплайн: download → `normalizeSource` (CRF17, **9:16 1080×1920 crop-fill**, 30fps) →
  WhisperX **Replicate** (words, ~$0.01/мин) → Sonnet retakes → `planCuts` → `cutAndBurn`
  (резка+сабы ОДНИМ энкодом, CRF18 High, AAC256/48k) → Finals + link-view + push.
- **ПРАВИЛА МОНТАЖА = HANDOFF §22.2b (BINDING):** pad ±0.2s, паузы <0.5s не резать,
  ≤2 поколений кодирования, шрифт бандловый (`assets/fonts` + fontsdir — на Vercel шрифтов НЕТ),
  кьюсы по фразам (`plan.cues`). Источник правил: My Bots `bot/scripts/process_video.py`.
- **Code:** `app/teleprompter/*`, `app/clips/*`, `lib/clips/*` (cuts/ffmpeg/whisper/srt/ass/
  captionStyles/notify), `app/api/clips/{from-recording,process,style,summary,[clipId]}`,
  `app/api/cron/clips-inbox` (раз в день 07:00 UTC — Hobby-лимит Vercel).
- **Стили сабов:** 4 статических + `ocean` (karaoke, ASS). Clinic default = `clinics.caption_style`.
- **Состояние (2026-07-25):** цепочка live, прогнана end-to-end. Последний cleaned-клип —
  ЕЩЁ ПО СТАРЫМ правилам резки; прогон по новым (мягкая резка + CRF18) Игорем не проверен.
- **Next (первым делом в видео-сессии):** удалить крестиком dead-строки (failed/processing) →
  Auto-edit на «Patient Lost 40 Pounds» → оценить плавность/чёткость. Затем тест с телефона
  вертикально (вебкам 720p при кропе мылит — лимит исходника). Бэклог: face-tracking кроп,
  audio loudnorm, сигнал >90s, ретрай залипших processing кроном, UI подписки на push
  (кнопку убрали — новым устройствам негде подписаться).
- **Gotcha:** kill switch `ENABLE_LLM_AGENTS=true` сейчас ВКЛЮЧЁН (нужен для Whisper/retakes).
  Закрытие страницы больше не убивает монтаж (waitUntil). См. `[[project_clips_pipeline]]`.
- **2026-08-19 — desktop-баг «Not recording» + новая страница `/videos`:**
  (а) На компе доктор жал «Start Recording» раньше, чем поднялась вебкам/разрешение →
  `beginRecording` молча пропускал `startRecording()` (stream ещё null), текст скроллился без
  записи («Reading…» + «Not recording» + Exit, без REC-таймера). Это было у ВСЕХ докторов на
  компе, не per-doctor. Fix в `TeleprompterView`: кнопка Start disabled («Starting camera…»)
  до `hasStream`; `startRecording()` возвращает boolean, без записи скролл не стартует;
  `recorder.onerror` показывает ошибку; при ошибке камеры — явная кнопка «Read without recording».
  (б) `/videos` (`app/videos/*`) — doctor-facing библиотека: табы Recordings / Edited
  (cleaned clips), Drive-embed плеер в приложении, read-only, «Open in Drive». Карточка
  «My videos» на дашборде (не adminOnly) + «Watch all →» в телепромптере. Не проверено
  визуально на Vercel (локальный dev не поднимался — RAM).

### 7. Studio (talking-head creator product)
- **Does:** TikTok ingest via Apify, format analysis (cover+caption vision), shot
  lists, Trash funnel, storage cleanup. Consumer-facing, transcript-based manual edit.
- **Code:** `app/studio/*`, `lib/studio/*`. See `[[project_studio_pipeline]]`, `[[project_studio_standalone]]`.

#### 7a. MA shoot board (added 2026-08-19, migration 049 APPLIED 2026-08-19)
The problem it solves: Igor was hand-writing a "how to shoot this" explanation
for every video he gave the medical assistants. The machine that writes that
brief already existed (`generateAndPinIdea`) — it was just being handed the
wrong role plan.

- **The bug that caused the manual work:** `shot_type` ('doctor' | 'clinic',
  migration 029) was set on insert but **never read** by `lib/studio/slots.ts`,
  so an MA-filmed b-roll card got `DEFAULT_ROLE_PLAN` — *"Doctor speaks directly
  to camera"*. Fixed: `rolePlanFor(shotType)` picks `CLINIC_ROLE_PLAN` (MA films
  alone on a phone, doctor NOT available, literal step-by-step) for 'clinic'.
- **Instagram now ingests — via embeds, deliberately not downloads.** IG CDN
  links expire in hours, so the TikTok "pull the mp4 through Apify and store it"
  path does not transfer. `lib/studio/embed.ts` derives the official iframe URL;
  `addStudioVideoByEmbed` inserts a row with `embed_url` and **no** stored file.
  IG paths all normalise to `/p/<code>/` (the one form that embeds every post
  type, and it dedupes `/p/` vs `/reel/`). TikTok keeps the old Apify path —
  it gives a real cover frame to analyse. **No Apify Instagram actor was added**;
  account-wide scanning was deliberately deferred (see below).
- **The one-line note replaces the transcript.** IG gives no cover frame, so
  `analyzeVideoFormat` runs caption-only on whatever line the admin types when
  pasting. One line in → full brief out.
- **Scheduling:** `shoot_date` on `studio_videos`, one video per clinic per day
  (partial unique index `uq_studio_videos_shoot_day`). `nextFreeShootDate` walks
  the taken set so unscheduled days get refilled. Days resolve in
  `Pacific/Honolulu` (`boardToday()`) — UTC would flip the board to tomorrow's
  card at 2pm Hawaii time.
- **The MA link:** `clinics.shoot_board_token` → public read-only
  `app/shoot/[token]`. Deliberately **not** an `access_tokens` row: that grants
  a clinic-wide role, this may only ever show dated shoot cards. `noindex`.
  Minted on demand from the Shot List tab, rotatable.
- **Code:** `lib/studio/{embed,schedule}.ts`, `lib/studio/slots.ts` (role plans),
  `lib/studio/addByUrl.ts` (`addStudioVideoByEmbed`), `app/shoot/[token]/*`,
  `app/api/studio/videos/add`, `app/api/studio/videos/[id]/schedule`,
  `app/api/studio/board-link`.
- **Deliberately NOT built:** attaching an Instagram account and browsing all its
  videos in-app. It rebuilds Instagram inside our app, IG anti-scraping makes it
  a permanent maintenance tax, and it does not touch the actual pain (writing the
  brief). `trend_sources` (migration 022) already accepts `platform:'instagram'`
  if this is ever revisited. Links are pasted by hand.
- **Unverified:** the generated MA brief has not been read by a human yet —
  that check needs migration 049 applied + a deploy. If the brief still needs
  hand-editing, this whole module misses its point.

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
- **Supabase** prod ref `pscqjvkuqqmvmcbxdwtu` (org `cxfsnpqcszytidcwrkvm`). Latest applied migration is
  **045** (compose_progress) — but that is a high-water mark, **not** "001-045 are all applied".
  **Known hole: `032_scheduled_posts.sql` was never run** (verified live 2026-08-13). Applying SQL =
  Igor pastes into the dashboard SQL editor (CLI/classifier blocks programmatic DB writes).
- **Vercel** auto-deploys from `main`. Env incl. `CANVA_{CLIENT_ID,CLIENT_SECRET,REFRESH_TOKEN}`
  (integration `OC-AZ-G1--eJ3lK`), `ENABLE_LLM_AGENTS`, Supabase/Google/Replicate/VAPID.
  `vercel --prod` and env writes are classifier-blocked → redeploy via empty commit + push.
- **Storage:** Drive primary + local backup (`[[project_storage_strategy]]`). See `[[project_pending_deploy]]`.
