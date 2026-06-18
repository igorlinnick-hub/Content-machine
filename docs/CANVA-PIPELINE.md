# Canva pipeline — pointer

The **source of truth** for the Canva carousel-build pipeline lives in
the sibling project:

```
~/Documents/Code Projects/Hawaii Wellness Clinic/My Bots & ALL Projects/docs/projects/canva-posts.md
```

That doc owns:

- ⚖️ Compliance gate constraints (BINDING)
- 🎨 Per-category brand template element-ID maps (ED `DAHK2poX3PY`, Peptides `DAHK2t13oEI`)
- 🖼️ Photo logic — 4 AI (Flux 1.1 pro ultra) + 4 stock (Pexels), Native Hawaiian editorial
- 🔄 The CM → Canva JSON contract (PostPlan shape)
- ⚠️ `per-line find_and_replace_text` rule — `replace_text` on the whole body element BREAKS bullets
- 🔧 Canva MCP tool list (`mcp__claude_ai_Canva__*`) — the runner uses these

**Read that doc at the top of any session that touches `lib/canva/*` or
`/api/posts/[id]/compose`.**

## What lives in this repo (Content Machine side)

| File | Role |
|---|---|
| `lib/canva/templates.ts` | Category → brand-template-id map (element IDs cached from spec) |
| `lib/canva/template-map.ts` | PostPlan → Canva autofill data (Connect-API fallback only) |
| `lib/canva/oauth.ts`, `lib/canva/api.ts`, `lib/canva/orchestrator.ts` | Optional Vercel-side fallback for Canva Connect REST (autofill flow). Not the primary path — kept for the "fully automated" future. |
| `lib/posts/photo-brief.ts` | Generates the `photo_brief[]` field on each PostPlan that the Canva runner consumes |
| `app/api/posts/[id]/compose/route.ts` | Marketer's "Compose" button — flips status to `ready_for_canva`, pings the runner, OR runs the Connect-based orchestrator inline if env vars are set |

## The primary runner

Per the spec the Canva runner is a **Claude CLI session with the
Canva MCP server attached** (`mcp__claude_ai_Canva__*`). When Igor
presses "Compose in Canva", the row queues; the runner session pulls
ready rows, drives Canva through MCP using the element-IDs in
`lib/canva/templates.ts`, and writes `render_result` back via the
Supabase service role.

The Vercel-side Connect REST path (`lib/canva/oauth.ts` →
`orchestrator.ts`) is kept as a future automation hook, gated on env
vars. Without the env vars the endpoint falls back to queue-only
behaviour.
