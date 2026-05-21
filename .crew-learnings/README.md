# .crew-learnings/ — passive knowledge log for this project

This folder is **breadcrumb storage** for the crew-template harvester. While you work in this project, drop short notes about things you learned, hacks you introduced, gotchas you hit, or patterns you noticed. The harvester (crew-template `/audit`) reads these later and promotes them into reusable skills / archetype improvements.

Spec source: `~/.claude/plans/noble-honking-cake.md` lines 125–200.
Harvester counterpart: `~/Documents/Code Projects/crew-template/skills/mine/audit/SKILL.md`.

## Format of one learning note

Filename: `YYYY-MM-DD-<short-topic>.md`

```markdown
---
date: YYYY-MM-DD
project: <project-name>
tags: [tag1, tag2]
type: skill | hack | gotcha | pattern | tool
---

## What
Briefly what happened / what I built / what I noticed.

## Why it matters
One line — why future-me would care.

## Next time
Concrete advice for the next instance of this kind of work.

## (optional) Link
Commit hash, file path, external URL.
```

## Rules

1. **Laziness is a feature.** 4 sloppy lines > nothing. Polish is harvester's job.
2. **Do not repeat the commit message.** Commit = "what changed". Learning = "what I learned".
3. **One learning = one file.** Two learnings = two files.
4. **Date in filename.** Sortable, no name collisions.
5. **Never edit historical learnings.** They're a record. New insight = new note.
6. **No secrets.** This folder is in git (potentially public). No API keys, tokens, PII.

## Types of learnings (when to use which)

| type | When to use | Example |
|---|---|---|
| **skill** | Built a reusable pattern | "Pattern: lite video loader — placeholder + click → iframe" |
| **hack** | Hardcoded / quick-fix that should be configurable | "Hardcoded Vimeo ID in HTML; should be config" |
| **gotcha** | Caught a bug or surprise behavior | "iOS Safari + position:fixed parallax exposes empty edge at bottom" |
| **pattern** | Noticed a repetition | "3rd HWC landing using same accordion — probably extract before 4th" |
| **tool** | Used a new service/library/MCP | "vumbnail.com — free Vimeo thumbnail proxy, no API key" |

## What NOT to write here

- Today's context (TODO list, what's broken now) → commit message or local README
- Emotional diary
- Bare bookmarks without your conclusion
- Duplicates of skills already in `crew-template/skills/`

## How the harvester uses these

`crew-template` session runs `/audit <project>`:
1. Reads `.crew-learnings/*.md` newer than last `.last-audit-*.md` marker
2. Groups by tag
3. Promotes:
   - `type: skill` → `crew-template/skills/mine/<name>/`
   - `type: hack` → `crew-template/archetypes/<x>/improvements.md`
   - `type: gotcha` → `crew-template/archetypes/<x>/memory/MEMORY.md`
   - `type: pattern` → triggers skill-extraction proposal if 2+ instances
   - `type: tool` → `crew-template/connectors/` if applicable
4. Drops a fresh `.last-audit-YYYY-MM-DD.md` marker.

Old breadcrumbs are **never deleted** — they are the historical record.
