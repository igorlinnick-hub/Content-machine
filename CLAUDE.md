# Content Machine — project briefing

## 📖 READ FIRST — how each module actually works

Before any deep work, read **[HANDOFF-MODULES.md](HANDOFF-MODULES.md)** — the
current per-module operating truth. (The 133 KB `HANDOFF.md` is history/spec; when
they conflict, HANDOFF-MODULES wins.)

**The one thing that gets forgotten:** Canva carousels are built by a **Claude +
Canva MCP runner in-session** (copy an example/master design → swap photos + text
per line → export), NOT by the server. Server-side auto-compose/autofill does not
work (needs Canva Enterprise brand templates the account doesn't have). If you ever
think "make the Compose button render it server-side" — stop and re-read the Canva
module. The words/photo-brief come from this app; the picture comes from the runner.

## What this is

AI-driven content generation system for HWC and multi-clinic via doctor install links. Next.js + TypeScript on Vercel, Supabase auth (per-doctor cookies), prompt-cached Claude (Haiku for light tasks, Opus/Sonnet for heavy), Replicate for Flux photos + Seedance video. **Canva carousels: assembled by the Claude+MCP runner (see above), not by the server.** Notifications = web push (VAPID) + in-app — **no Telegram** (removed 2026-07-06).

5-agent pipeline: Analyst → Research → Writer → Critic → Diff (SharedContext object). Prompt caching cut API cost ~70-85%.

## ⚖️ COMPLIANCE (BINDING — read before touching generation)

Every script/post this machine generates is for a regulated medical clinic (FDA/FTC exposure —
clinics have been sued for the exact wording we produce). **Generation must be compliant by
construction, and nothing publishes without a compliance check.**

- **Integration brief (how to wire it):** [docs/COMPLIANCE-INTEGRATION.md](docs/COMPLIANCE-INTEGRATION.md)
- **Rules (source of truth, machine-readable):** [docs/compliance-ruleset.md](docs/compliance-ruleset.md) (v2.1) — read, don't paraphrase. Re-sync from My Bots `docs/projects/content-compliance.md` when it changes.
- **Plain-language do/don't:** [docs/compliance-playbook.md](docs/compliance-playbook.md)

Plan: **Layer A** — inject the rules into Writer + Critic system prompts (generate compliant).
**Layer B** — a `lib/agents/compliance.ts` gate after Critic / before publish that grades each
item (REMOVE/REWORD/REVIEW/PASS), blocks REMOVE/REWORD, never emits a bare PASS, never says
"safe/compliant". Never auto-publish a REMOVE. Final sign-off = medical director + counsel.

## Crew system (you are a doer in Tier 1) — audited 2026-05-18

This project is **linked** to the crew-template at `~/Documents/Code Projects/crew-template/`. The harvester ran `/audit "Content machine"` on 2026-05-18 and produced:

- **Archetype**: `content-machine` v0.1 alpha. See `~/Documents/Code Projects/crew-template/archetypes/content-machine/`.
- **Skills extracted**: `multi-agent-verify-refine`, `prompt-caching-cost-cut` (`crew-template/skills/mine/`).
- **Deferred for next pass**: `conversational-telegram-router` (cross-project pattern with Chat Bots/Antonia), `serverless-puppeteer-render`, `diag-endpoint-pattern`.

### How to keep the loop alive

- **Drop a breadcrumb** in `.crew-learnings/YYYY-MM-DD-<slug>.md` whenever you build a new agent pattern, change prompt-cache strategy, add a Replicate model, hit a Puppeteer gotcha, or add a per-clinic feature.
- **Don't audit yourself** — that's the harvester's job. From the crew-template session run `/audit "Content machine"` after the next shippable milestone.
- **Constitution** at `~/Documents/Code Projects/crew-template/CONSTITUTION.md` applies — terse, decision-first, label confidence, dual-advice format (Совет от Crew / Мой личный совет) when recommending.

### Improvements queue

`~/Documents/Code Projects/crew-template/archetypes/content-machine/` — check `improvements.md` (when populated) for known fixes. Right now archetype is at v0.1 alpha with 1 audited instance; the queue grows after next audit.

## Post craft (carousels)

**[docs/POST-CRAFT.md](docs/POST-CRAFT.md) is binding for any carousel work** —
the craft bible for voice/tone (educational, warm, anti-AI-slop), the
slide-shape catalog (comparison, research statement, checklist, numbered path,
analogy+takeaway, pull-quote), spacing rules (blank line between every item —
no walls), design elements (dividers, `✓`/`①` markers, photo-in-photo, magazine
treatment, panel-fit), and photo direction (aesthetic-first, ~60/40 AI/stock,
no close-up-face covers). The writer/splitter own the text rules; the
`canva-compose-runner` skill owns the layout/design rules.

## Tech reminders

- **Read [HANDOFF-MODULES.md](HANDOFF-MODULES.md) first** every deep session — per-module current truth. `HANDOFF.md` §15/§16 = historical ledger.
- 5-agent pipeline architecture — see `crew-template/skills/mine/multi-agent-verify-refine/SKILL.md` for the extracted pattern.
- Prompt caching strategy: Haiku for light, Sonnet/Opus for heavy. See `crew-template/skills/mine/prompt-caching-cost-cut/SKILL.md`.
