# Content Machine — project briefing

## What this is

AI-driven content generation system for HWC and multi-clinic via doctor install links. Next.js + TypeScript on Vercel, Supabase auth (per-doctor cookies), prompt-cached Claude (Haiku for light tasks, Opus/Sonnet for heavy), Replicate for Seedance 2.0 video pipeline, serverless Puppeteer for slide rendering (1080×1350), Telegram bot LLM router.

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

## Tech reminders

- Read HANDOFF docs (§15, §16, §17, §18 mentioned in commits) before deep session.
- 5-agent pipeline architecture — see `crew-template/skills/mine/multi-agent-verify-refine/SKILL.md` for the extracted pattern.
- Prompt caching strategy: Haiku for light, Sonnet/Opus for heavy. See `crew-template/skills/mine/prompt-caching-cost-cut/SKILL.md`.
