# Content Plan — Hawaii Wellness Clinic — Jun 2026

**Source:** `Content_Plan_Jun 2026-HawaiiWellness_Carousels_v2.pdf`
**Status:** authoritative few-shot template seed + compliance baseline
**Format:** 24 image carousels, 8-week cycle, 3/week, 6-8 slides each, 4:5 portrait

This file is the **source of truth** for both the writer's few-shot library and the compliance audit baseline. Every claim in here was source-checked against primary sources in June 2026. The structural patterns below are non-negotiable — the writer must produce carousels in this shape.

---

## 1. Category buckets

| Bucket | Color tag | Post count |
|---|---|---|
| **Mental Health** | sky-500 / `#0EA5E9` | 9 (posts 01-03, 13-15, 19-21) |
| **Pain & Joint** | amber-700 / `#B45309` | 4 (posts 07-09, 22) |
| **Wellness & Vitality** | teal-600 / `#0F766E` | 7 (posts 04-06, 16-18, 24) |
| **Weight Loss** | violet-500 / `#A855F7` | 4 (posts 10-12, 23) |

These bucket names appear in `category` field of the post-plan JSON (§15 of HANDOFF-POSTS.md).

---

## 2. Universal structural template (every post)

Every carousel produced by the writer **MUST** follow this slide arc:

```
SLIDE 1 — COVER
  title (mixed case, NOT all-caps — varies per template_variant)
  hook (one specific stat or framing line, ends with "Swipe →")

SLIDE 2 — MECHANISM / THE REAL CAUSE
  heading (what's actually going on)
  intro (one framing line)
  bullets[3] (the underlying biology / facts)
  close (one-line pivot: "what standard care misses")

SLIDE 3 (optional) — "WHY YOU WEREN'T TOLD THIS" gap slide
  heading
  intro
  close (explains the structural / financial / time-constraint reason
         standard medicine skips this)

SLIDE 4 — "THINK OF IT THIS WAY" sticky analogy   ← 23 of 24 posts have this
  Plain prose, no bullets, no heading row.
  Format: "X is like Y — [the punchline that makes the mechanism click]"
  Examples from the plan:
    Ketamine = "flipping the main breaker back on"
    Treatment-resistant depression = "the lock is different — you need a different key"
    NSAIDs = "switching off a smoke alarm while the stove keeps smoking"
    NAD+ = "spark plugs in every cell's engine"
    GLP-1s = "fixing a thermostat that was stuck"
    Chronic anxiety = "a car idling at high RPM in neutral"
    TMS = "a trainer doing assisted reps for an underactive muscle"
    PRP = "concentrating your blood's own repair crew"
    SGB = "briefly cuts power to the alarm panel"
    Peptides = "a text message telling the body to make its own"
    ED arteries = "the canary in the coal mine"
    A2M = "guards that cuff the specific vandals chewing through the cartilage"
    Retatrutide = "pulls three levers at once"
    Standard blood panel = "smoke detector — great at catching a fire that's already started"

  IMPORTANT: Post 20 (suicidal ideation) deliberately SKIPS the analogy.
             Mental-health-acute topics stay plain and clinical.

SLIDE 5 — WHAT THE DATA SHOWS (evidence payoff)
  bullets — actual numbers, trial names, FDA dates
  This lands AFTER the analogy so the proof reads as payoff, not opener.

SLIDE 6-7 — APPLICATION / WHO IT'S FOR / WHAT A SESSION LOOKS LIKE
  bullets — protocol details, candidacy criteria

SLIDE 8 — "WHY IT'S UNDERUSED" / "THE HONEST SUMMARY"
  Optional. Frames the gap between standard care and what's available.

FINAL SLIDE — CTA STACK
  Three lines, in this exact order:
    Follow   → "@hawaiiwellness for science-backed wellness, no hype."
    Comment  → "<KEYWORD>" + what we send when they comment
    Book     → "tap the link in bio or DM us to start an evaluation."
```

The CTA stack is **always 3 lines** (Follow + Comment + Book). The keyword is a single ALL-CAPS word from a hardcoded set — see §3.

---

## 3. CTA keywords (deterministic, post → keyword map)

| Post | Topic | Keyword |
|---|---|---|
| 01 | Ketamine for depression | RESET |
| 02 | Antidepressant failure | MECHANISM |
| 03 | Signs standard treatment has hit ceiling | SIGNS |
| 04 | Hormones after 40 | HORMONES |
| 05 | Testosterone isn't about muscle | TESTOSTERONE |
| 06 | NAD+ | NAD |
| 07 | Painkillers don't heal joints | JOINT |
| 08 | PRP | PRP |
| 09 | Shockwave | SHOCKWAVE |
| 10 | Why diets fail | METABOLISM |
| 11 | Semaglutide story isn't the scale | SEMAGLUTIDE |
| 12 | 30 days on a GLP-1 | GLP1 |
| 13 | SGB for PTSD | SGB |
| 14 | Anxiety isn't only in your head | ANXIETY |
| 15 | TMS for depression | TMS |
| 16 | Peptides | PEPTIDE |
| 17 | IV drips | IV |
| 18 | Erectile dysfunction | VITALITY |
| 19 | Spravato | SPRAVATO |
| 20 | Suicidal ideation | SUPPORT (special — no Follow/Book stack, only Comment + 988) |
| 21 | "Just talk to someone" isn't enough | CLARITY |
| 22 | A2M | A2M |
| 23 | Retatrutide | RETATRUTIDE |
| 24 | Comprehensive blood panel | PROGRAM |

When the writer creates a new post on a similar topic, it should pick the matching keyword OR generate a new ALL-CAPS single word that captures the post's hook.

---

## 4. Compliance baseline — what every post in this plan does correctly

These are the binding patterns. The writer + critic + compliance gate must enforce them.

### 4.1 Always-hedged language
- "We don't promise outcomes" — appears in or implied by every therapeutic post
- "Results depend on the formulation and the indication" (post 07)
- "Pilot studies report" / "Studies show benefit" / "Phase 2 data" — never "will work"
- "Responses vary" (post 06 NAD+) — never "you will feel"
- "Animal data, minimal human data" (post 16 peptides) — labels evidence stage explicitly

### 4.2 FDA / approval labels (exact wording)
- TMS: "FDA-cleared" — depression 2008, OCD 2018, smoking 2020, **anxious depression 2021** (not 2020)
- Spravato: "FDA-approved" — TRD Mar 2019, MDD-w-suicidal-ideation 2020, **monotherapy Jan 2025**
- SELECT: 17,604 adults with **established cardiovascular disease** (don't drop "established"), −20% MACE, NEJM 2023
- Retatrutide: **investigational, not FDA-approved** (NEJM 2023 Phase 2; TRIUMPH Phase 3 Dec 2025)
- Peptides (BPC-157, TB-500, CJC-1295/Ipamorelin): **"not FDA-approved"** stated plainly
- Exosomes: NEVER mention as a service offered (FDA: no approved exosome products)

### 4.3 Forbidden constructions (the compliance ruleset enforces these)
- ❌ "treats / cures / reverses [disease]"
- ❌ "regenerates / restores [body part]"
- ❌ "guaranteed" / "100%" / "miracle"
- ❌ "safe" / "compliant" anywhere in user-facing output
- ❌ Specific percentage claims that aren't sourced (e.g. "NAD+ drops 80% by age 60" — the plan v2 deliberately removed unverified percentages)

### 4.4 Sourced claims required for every "data" slide
Every post in the plan ends with a `Sources (verified — internal, not for publication)` block listing the actual studies. The writer must produce equivalent backing — the compliance gate refuses to PASS posts with bare statistics that have no source attached. Sources go into the post metadata, **never into the published caption**.

### 4.5 Mental-health 988 line
Posts 01, 02, 03, 13, 14, 15, 19, 20, 21 (all `Mental Health` bucket) — caption MUST end with the crisis line. Plan post 20 (suicidal ideation) is the canonical example: the entire CTA structure changes — no "Follow / Book" stack, only `Comment → SUPPORT` + `In crisis? Call or text 988 (US).` Keep tone clinical, no analogy.

---

## 5. Reference posts (full text) — feed these into `few_shot_library`

Below are 4 canonical posts spanning the 4 buckets, kept verbatim so the writer's few-shot pulls produce output in this exact register. The other 20 posts in the PDF should be ingested via a seed script.

### 5.1 Post 01 — Mental Health — Ketamine

**Cover**
- Title: *What Ketamine Does to Depression*
- Hook: *The neuroscience most patients are never walked through. Swipe →*

**Slide 2 — The model that aged out**
- Intro: For years the standard path was: try one antidepressant, wait four to six weeks, switch, repeat.
- Bullets: (none — body sentences only)
- Body: What rarely got explained: roughly one in three people with major depression don't get an adequate response to standard antidepressants — a biology question, not a willpower one. The science moved on. The public conversation didn't.

**Slide 3 — A different system**
- Intro: Standard antidepressants act mostly through serotonin — a slow, weeks-long process. Ketamine acts through glutamate, the brain's main excitatory neurotransmitter, via the NMDA receptor.
- Bullets:
  - Glutamate signaling triggers neuroplasticity — new synaptic connections
  - In preclinical work this begins within hours, not weeks
  - Human imaging supports rapid synaptic change after treatment
- Close: Different mechanism. Different timeline.

**Slide 4 — Think of it this way**
- Body: Serotonin antidepressants are like repainting a house one room a week — slow, gradual. Ketamine works more like flipping the main breaker back on: the glutamate system rewires connections fast, so change can begin in hours.

**Slide 5 — What the data shows**
- Bullets:
  - Around 60–70% of people with treatment-resistant depression show a meaningful response to a ketamine course
  - One of the fastest documented effects on acute suicidal ideation of any intervention
  - Effects can appear within hours; a standard course is several infusions over 2–3 weeks
- Close: This is a mechanism with evidence behind it — not a miracle claim.

**Slide 6 — Who it's actually for**
- Intro: Ketamine therapy starts with an evaluation, not a booking.
- Bullets:
  - Two or more antidepressants tried without lasting benefit
  - Meaningful impairment despite treatment
  - Acute suicidal ideation needing a faster intervention
  - Already in, or open to, psychotherapy
- Close: The aim is to add a neurobiological lever — not to replace existing care.

**Slide 7 — What a session looks like**
- Bullets:
  - IV infusion, about 40–60 minutes, in a clinical setting
  - You stay awake and monitored throughout
  - A mild, supervised dissociative experience
  - No driving afterward
- Close: This is a medical protocol, not something self-administered.

**Slide 8 — Why the old model held on**
- Body: Standard care is built around what fits a 15-minute visit: write the next prescription. A mechanism that needs an evaluation and an in-clinic protocol doesn't fit that format — so it rarely comes up, even when the evidence supports it.

**Slide 9 — The bottom line**
- Intro: Treatment-resistant depression is a defined medical status — it means your biology needs a different entry point.
- Close: Ketamine is one of the most studied options for exactly that situation. We explain the mechanism honestly and don't promise outcomes.

**CTA Stack — keyword: RESET**
- Follow → @hawaiiwellness for science-backed wellness, no hype.
- Comment → "RESET" and we'll send a link to book an initial consultation.
- Book → tap the link in bio or DM us to start an evaluation.

**Caption hashtags:** #ketaminetherapy #depression #brainhealth #mentalhealth #treatmentresistant #hawaiiwellness
**988 line in caption:** YES (Mental Health bucket)

**Sources (NOT published):**
- ~1/3 of MDD is treatment-resistant: Matveychuk et al., Ther Adv Psychopharmacol 2020
- Glutamate/NMDA & rapid synaptogenesis: Duman & Aghajanian, PNAS 2023 review
- Response ~60–70% / remission ~30% in TRD: Frontiers in Psychiatry 2022 review

---

### 5.2 Post 07 — Pain & Joint — Painkillers

**Cover:** *Why Painkillers Don't Heal Joints* / Hook: *The ibuprofen mutes the signal. The tissue keeps changing. Swipe →*

**Key analogy slide:** "Ibuprofen is like switching off a smoke alarm while the stove keeps smoking. The noise stops; the fire doesn't. Regenerative care goes to the stove."

**Key compliance markers:**
- NSAIDs "associated with impaired cartilage healing" (not "destroy" / "ruin")
- PRP "outperformed hyaluronic acid" — sourced to Belk et al., AJSM 2021
- "Results depend on the formulation and the indication, so it isn't right for every joint."

**CTA keyword:** JOINT
**Sources:** Belk et al. AJSM 2021; AAOS PRP overview; orthopaedic literature.

(Full slide text in PDF — ingest via seed.)

---

### 5.3 Post 18 — Wellness & Vitality — Erectile Dysfunction

This is the **canonical example for §15 of HANDOFF-POSTS.md** (target output shape). The JSON in HANDOFF-POSTS.md §15 was extracted from this post. Full text in PDF pages 28-30.

**CTA keyword:** VITALITY
**Statistical correction (v2):** ~52% of men aged 40–70 (Massachusetts Male Aging Study) — NOT "over 40"
**Key claim:** ED predominantly vascular & precedes CVD events by years (JACC/Circulation, MESA cohort)
**Forbidden:** "PRP regenerates penile tissue" (use "may support endothelial regeneration / pilot studies report")

---

### 5.4 Post 11 — Weight Loss — Semaglutide

**Cover:** *Semaglutide: The Story Isn't the Scale* / Hook: *Everyone watches the number. The data points somewhere more interesting. Swipe →*

**Key analogy:** "Semaglutide isn't a furnace that burns fat. It's more like fixing a thermostat that was stuck — once the signaling works again, the system self-corrects, and weight loss is the visible result."

**Critical compliance fix from v2:** SELECT trial inclusion = "17,604 adults with **established cardiovascular disease**" — the word "established" was dropped in earlier versions. Restore.

**CTA keyword:** SEMAGLUTIDE
**Sources:** SELECT (Lincoff et al., NEJM 2023); STEP program NEJM/JAMA 2021.

---

## 6. How to use this file

### 6.1 Writer agent (`lib/agents/writer.ts`)
- Pull §2 (structural template) verbatim into the system prompt.
- Inject §4 (compliance baseline) as hard constraints — these complement, not replace, `docs/compliance-ruleset.md`.
- Use §5 (4 canonical posts) as in-prompt few-shot examples for the corresponding category.
- For categories not represented in §5 (e.g. a new "Cardiac" bucket), fall back to the closest category's structural pattern.

### 6.2 Few-shot library (`few_shot_library` table)
- Ingest the full text of all 24 posts as `script_text` rows.
- Tag each with: `topic` = canonical slug, `score` = 10 (these are gold-standard).
- The Writer's `runWriter` already pulls from this table — just seed it.
- Migration to seed: add a `lib/seeds/content-plan-2026-06.ts` that idempotently inserts the rows on first generate.

### 6.3 Compliance gate (`lib/agents/compliance.ts`)
- Use §4.2 (FDA/approval labels) as a hard checklist. Any post claiming an FDA status that doesn't match § 4.2 → REWORD finding.
- Use §4.3 (forbidden constructions) as regex grep before LLM grading — catches the obvious before paying for the model call.
- Use §4.5 (988 line) as a post-processing requirement on Mental Health captions.

### 6.4 Caption generator (extends `lib/agents/captioner.ts` or new module)
- Produces the caption that goes in `caption` field of the post-plan JSON.
- Always ends with hashtag set from §5.
- Always ends with 988 line for Mental Health bucket.
- Never includes "Sources (verified — internal)" — that's for the medical director review only.

---

## 7. Versioning

This file is bundled here as the **June 2026 plan**. When marketing publishes a new content plan:

1. Diff the new plan against this file.
2. Update the post → keyword map (§3) for any new topics.
3. Update §4 (compliance baseline) for any new FDA / dosage / trial corrections.
4. Add new canonical few-shot posts to §5 if a new category bucket is introduced.
5. Re-seed `few_shot_library` for the affected clinic.

The PDF source remains the authoritative reference. This markdown is the machine-readable digest.
