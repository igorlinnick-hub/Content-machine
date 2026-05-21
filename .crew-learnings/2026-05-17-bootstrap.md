---
date: 2026-05-17
project: Content machine
tags: [bootstrap, snapshot, content-machine, ai-agents, telegram-bot]
type: pattern
---

## What
AI-driven content generation system. Next.js + TypeScript on Vercel, Supabase auth (per-doctor cookies), prompt-cached Claude (Haiku for light tasks, Opus/Sonnet for heavy). Generates Instagram scripts, posts/slides (1080×1350 HWC-style typed-slide renderer via serverless puppeteer), and Seedance 2.0 video pipeline via Replicate.

Recent work (last 50 commits show density): team/briefing layer + /clips pipeline + verify/refine flow (commit `6f53259`). Conversational Telegram LLM router replaces slash commands (`1b827c0`). Prompt caching for cost cut ~70-85% (`7230cf8`). Per-clinic logo upload to Supabase Storage (`b5d5d6a`). Few-shot library editor with categories+triggers (`e115c09`). Premium light/dark redesign with Inter + orange accent (`3aae25f`). Onboarding wizard rebuild (`c1e6cd6`).

Architecture signals: `app/`, `lib/`, `modules/`, Supabase auth, multi-doctor multi-tenancy, multiple AI agents (writer/research/refine/diff), Drive integration for category photos.

Synthesized from `git log -50` + folder `ls` on bootstrap.

## Why it matters
This is the most knowledge-dense project after HWC. It is the canonical seed for the `content-machine` archetype (Phase 6 in plan). It also has a working Telegram bot LLM router that overlaps with `Chat Bots/Antonia` — cross-project pattern.

Many implementation decisions here (prompt caching, multi-agent verify/refine, few-shot pinning, per-clinic branding) are likely candidate `skills/mine/` extractions and would form the core of the content-machine archetype.

## Why it matters specifically for me (Igor)
This is the most production-ready of the AI-creator projects. When auditing, **look here first** for reusable AI-pipeline patterns before extracting from less-mature ones.

## Next time
- When working here: write learnings whenever you touch prompt caching, agent orchestration (writer→verify→refine), Telegram LLM router, or per-clinic onboarding. These are the surfaces most likely to generalize.
- Type `skill`: any new agent pattern, any prompt-cache config, any few-shot editor improvement.
- Type `hack`: per-clinic hardcodes (logo URLs, brand colors not in DB), any Replicate model ID hardcoded.
- Type `tool`: every new external service (Replicate models, Drive endpoints, Puppeteer flags).
- Real metric: cost-per-generated-post and posts-shipped-per-doctor-per-week. Both are measurable in Supabase + Replicate dashboards.

## Link
- Folder: `~/Documents/Code Projects/Content machine/`
- Latest commit at bootstrap: `6f53259` team: briefing layer + real handoffs + /clips pipeline + verify/refine + delegation + captions + install PWA card
- HANDOFF docs referenced in commits: §15, §16, §17, §18 — read those before next deep session
