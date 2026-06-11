# Content Compliance — what this is & how to wire it into Content Machine

**Audience:** whoever builds the script/post generators here (the agent team) + Claude sessions
working in this repo.
**Status:** instruction brief. The rules are DONE and validated; the *integration* into Content
Machine is yours to implement — this doc tells you exactly what and how.

---

## 1. Why this exists (read first)

Hawaii Wellness Clinic markets **regenerative / stem-cell / exosome / PRP / GLP-1 / ketamine**
therapies. The clinic's owner Phil flagged (after a call with Shawn) that how we word these
carries **real FDA/FTC enforcement and lawsuit exposure** — clinics have been sued and shut down
for exactly this. So **every script and post this machine generates must be compliant by
construction**, and nothing should publish without a compliance check.

A full audit of the clinic's 330 existing Instagram posts found **~30%** crossed a rule (29
remove, 75 reword, 165 review). Two finished doctor videos were graded REMOVE. This is not
hypothetical — the machine is generating into a regulated space.

The authoritative rules + the human story live in the **My Bots & ALL Projects** repo:
- **Ruleset (machine-readable, source of truth):** `docs/projects/content-compliance.md` (v2.1).
  A **copy is bundled here** at `docs/compliance-ruleset.md` — keep it in sync (see §6).
- **Team playbook (plain language):** `docs/clinic-handoffs/content-compliance-playbook.md`.
- **CLI skill** `hwc-content-compliance` (for local Claude Code sessions — NOT this app).

⚠️ This is a **screening system, not legal advice**. Final sign-off is always the medical
director + counsel.

---

## 2. The rules every generated script/post must follow

Generate so these are NEVER produced (this is the writer's job — write compliant from the start):

1. **No claim a therapy treats / cures / reverses a disease, or regenerates / restores a body
   part.** Stem cells, exosomes, biologics, PRP are **not FDA-approved** for these uses.
2. **Never mention exosomes as a service offered** (FDA: no approved exosome products).
3. **"FDA-approved" only if literally true** for that exact product (compounded GLP-1 and most
   devices are NOT; devices are "cleared," not "approved").
4. **No success stats** ("85%", "100%") or "clinically proven" without a study on file.
5. **No guarantees** — "guaranteed / permanent / for good / lasting / cure."
6. **Testimonials:** a patient may share *experience* ("staff was great, I feel like myself"),
   but **never credit a medical result to a therapy** ("the stem cells healed my knee"). A
   patient's words become the clinic's claim (FTC 16 CFR §255.1); a "results vary" disclaimer
   does NOT fix an efficacy claim.
7. **Off-label drugs are not "approved"** — IV ketamine for depression (only Spravato is), and
   compounded GLP-1. Frame as "physician-supervised, off-label."
8. **No before/after / transformation visuals** (also in Stories/Highlights, hashtags, emojis,
   file names).
9. **No fake / AI / employee / incentivized reviews**, and don't gate to only-positive (FTC
   Fake Reviews Rule, 16 CFR 465).

**Safer phrasing (not a shield):** education on a condition/mechanism · "may support" /
"designed to support" · "many patients report… results vary" · "book a free consultation"
(don't pair a CTA with a specific condition, e.g. "struggling with ED? free consult").

**The one test:** *"Would a patient read this as a promise of what THEY will get?"* If yes → it's
a claim → it must follow the rules.

The full numbered rules (R-SC / R-EXO / R-BIO / R-PRP / R-FDA / R-SUB / R-GUAR / R-TEST / R-DIS /
R-OFL / R-REV / R-DEV / R-MISC), the authorities behind each, and the precedence logic are in
`docs/compliance-ruleset.md`. **Do not paraphrase the rules into code — read the file.**

---

## 3. The verdict model

Every check returns ONE of: `REMOVE` (high-risk, block) · `REWORD` (fixable wording) ·
`REVIEW` (borderline, human) · `PASS (text only)` (no text rule crossed). Precedence: any
REMOVE → REMOVE; else REVIEW; else REWORD; else PASS.

---

## 4. How to wire it in (this app's architecture)

This app already has: `lib/agents/base.ts` (Anthropic client via `getAnthropic()` / API key),
agents (`writer.ts`, `critic.ts`, `captioner.ts`, …), and a team (`lib/team/personas.ts`,
Marek=writer with a `verify_post` action). Two layers:

### Layer A — generate compliant (cheap, do first)
Inject the rules into the **writer (Marek)** and **critic** system prompts. Concretely: load
`docs/compliance-ruleset.md` and prepend a condensed "MUST FOLLOW" block (the §2 list) to their
`systemPrompt`. Now scripts/posts come out compliant by default. Use `cache_control: ephemeral`
on the stable ruleset block (base.ts already supports it) so you don't pay to resend it.

### Layer B — pre-publish gate (the safety net, required)
Add `lib/agents/compliance.ts` (mirror `critic.ts`): it takes the generated caption / video
script, loads the **full** ruleset, and asks Claude for a structured verdict. Wire it as the
**last step before a post/script is queued or sent** (extend Marek's `verify_post`, or add a
gate in the publish path). On `REMOVE`/`REWORD` → block + return findings to the operator; on
`PASS` → allow, but stamp the caveat.

Reference judge prompt + output contract are in the My Bots repo:
`bot/scripts/compliance_analyze.py` and `~/.claude/skills/hwc-content-compliance/grade_one.py`
(Python, subscription CLI). **Port the same prompt to TS** using `getAnthropic()`. Model: use
`MODEL_CRITIC` (Opus) for the gate — legal-grade judgment.

### Optional — a "compliance" persona
Add a persona in `lib/team/personas.ts` so an operator can type "check this" in the team chat
and get the same grade on demand.

### Output contract the gate must return (per item)
```json
{
  "action": "REMOVE|REWORD|REVIEW|PASS",
  "summary": "<=1 sentence, definite (no 'potentially/may')>",
  "findings": [{"rule_id":"R-..","quote":"verbatim offending words","why":"definite reason"}],
  "rewrite": "<only when REWORD; else empty>",
  "ruleset_version": "2.1"
}
```

---

## 5. Hard guardrails (bake these into the gate)
1. **Never output a bare "PASS".** It's `PASS (text only)` + always: *"images / before-after /
   video frames not reviewed — they can violate on their own."* The text gate cannot see visuals.
2. **Never say "safe", "compliant", "approved", "cleared."** It's a screening aid, not legal
   clearance. Always show `ruleset_version` + a "not legal advice / counsel review" line.
3. **Rewrites only for REWORD, watermarked "DRAFT — not counsel-approved."** No "fixed" version
   for REMOVE (e.g. an exosome offer can't be reworded into compliance — it must be cut).
4. **Fail loud.** If the model call errors/times out → "JUDGE UNAVAILABLE — no verdict, do NOT
   treat as pass." Never fail-open to PASS.
5. **Cite only real `rule_id`s and quote verbatim** (validate the quote is a real substring;
   drop hallucinated findings).

---

## 6. Single source of truth (don't let rules drift)
The canonical ruleset is `content-compliance.md` in the My Bots repo. The bundled copy here
(`docs/compliance-ruleset.md`) must be re-synced whenever it changes (it's `ruleset_version`-
stamped — compare versions). Suggested: a tiny `scripts/sync-ruleset` that copies it, or a CI
check that fails if versions differ. The gate must print the version it used.

---

## 7. Cost note
This app calls the **Anthropic API** (paid), unlike the local CLI skill (subscription/free).
The gate adds ~1 Opus call per generated item — small, but real. Cache the ruleset block
(Layer A) and only run the full gate once per final draft.

---

## TL;DR for the implementer
1. Bundle + sync the ruleset (`docs/compliance-ruleset.md`).
2. Layer A: prepend the §2 "MUST FOLLOW" block to writer + critic system prompts.
3. Layer B: `lib/agents/compliance.ts` gate (Opus) before publish → block REMOVE/REWORD, return
   findings; honor the §5 guardrails + §4 output contract.
4. Never auto-publish a REMOVE; never emit a bare PASS; final call = counsel.
