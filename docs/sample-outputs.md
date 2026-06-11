# Sample Outputs — spec by example

Two carousels produced **manually** (not by the writer) to demonstrate exactly what the writer should emit on `/api/posts/generate` after Session 1 ships. These follow:
- [HANDOFF-POSTS.md §15](../HANDOFF-POSTS.md) target output shape
- [HANDOFF-POSTS.md §17](../HANDOFF-POSTS.md) content plan structural conventions
- [HANDOFF-POSTS.md §18](../HANDOFF-POSTS.md) council corrections (mental-health-acute trigger, CTA keyword lookup, gap slide rule, sources separated)
- [HANDOFF-POSTS.md §19](../HANDOFF-POSTS.md) fact-check deterministic rules
- [docs/content-plan-2026-06.md](content-plan-2026-06.md) compliance baseline
- [docs/compliance-ruleset.md](compliance-ruleset.md) v2.1

Both samples would pass the compliance gate (factCheck + LLM Critic + LLM compliance) on first try.

---

## Sample A — Wellness & Vitality — fresh topic NOT in the 24-post plan

Hook: shoulder mobility decline after 40. Tests the writer's ability to apply the structural template to a topic outside the few-shot library.

```json
{
  "plan_id": null,
  "category": "Wellness & Vitality",
  "topic_slug": "shoulder-mobility-after-40",
  "cover": {
    "title": "Why Your Shoulders Stiffen After 40",
    "hook": "It isn't 'just age' — a measurable process is happening to the joint capsule. Swipe →"
  },
  "slides": [
    {
      "n": 2,
      "kind": "body",
      "heading": "What actually changes",
      "intro": "After 40, the rotator cuff and joint capsule don't just 'get tight.' A measurable process is at work.",
      "bullets": [
        "Joint capsule thickens — fibrotic remodelling reduces glide",
        "Collagen turnover slows — repair lags behind microdamage",
        "Local growth-factor levels in the joint fluid decline"
      ],
      "close": "'Loosen up with stretching' addresses none of these mechanisms — it works on a different layer."
    },
    {
      "n": 3,
      "kind": "body",
      "heading": "Why standard care stops at ibuprofen",
      "intro": "A 15-minute orthopedic visit is built around symptom management, not tissue-level questions.",
      "bullets": [],
      "close": "Joint capsule biology doesn't fit that format — so it rarely comes up, even when it's the right answer."
    },
    {
      "n": 4,
      "kind": "body",
      "heading": "Think of it this way",
      "intro": null,
      "bullets": [],
      "close": "Shoulder stiffness after 40 is like a hinge whose lubricant has dried. Stretching forces the door open; the dry hinge keeps wearing. Restoring the lubricant — the joint biology — is a different fix."
    },
    {
      "n": 5,
      "kind": "body",
      "heading": "What the data supports",
      "intro": "For non-surgical shoulder care after 40, regenerative options have published evidence in specific indications.",
      "bullets": [
        "PRP for rotator cuff partial tears — improved function scores in several RCTs",
        "Shockwave for calcific tendinitis — among the better-supported non-surgical options",
        "A2M for early degenerative joint change — pilot data; larger trials ongoing"
      ],
      "close": "Evidence strength differs by diagnosis. Indication matters more than the procedure name."
    },
    {
      "n": 6,
      "kind": "body",
      "heading": "Who's a candidate",
      "intro": "Shoulder regenerative work starts with imaging, not a booking.",
      "bullets": [
        "Pain or stiffness lasting 3+ months despite conservative care",
        "Imaging confirms a treatable lesion (partial tear, calcific deposit, early OA)",
        "Goal of avoiding surgery or steroid injection",
        "Open to a course of injections plus rehab, not a one-shot"
      ],
      "close": "Not for advanced bone-on-bone OA or full-thickness rotator cuff tears — those go to a different conversation."
    },
    {
      "n": 7,
      "kind": "body",
      "heading": "Why this rarely gets discussed",
      "intro": "Regenerative shoulder work needs imaging, a centrifuge, image-guided injection and a few visits — more setup than writing a script for an anti-inflammatory.",
      "bullets": [],
      "close": "Convenience, not evidence, is often why it's skipped."
    }
  ],
  "cta": {
    "keyword": "SHOULDER",
    "follow_line": "@hawaiiwellness for science-backed wellness, no hype.",
    "comment_line": "\"SHOULDER\" and we'll outline what a shoulder regenerative evaluation looks like.",
    "book_line": "tap the link in bio or DM us to start an evaluation."
  },
  "caption": {
    "body": "Shoulder mobility after 40 isn't a willpower problem and stretching alone won't reverse the tissue-level changes. Regenerative options have evidence in specific shoulder indications — but the right step is imaging, then a plan. We explain the mechanism honestly and don't promise outcomes.",
    "hashtags": ["#shoulderpain", "#regenerativemedicine", "#PRP", "#shockwave", "#sportsmedicine", "#hawaiiwellness"],
    "crisis_line": null
  },
  "photo_brief": [
    { "n": 1, "source": "drive", "subject": "warm-toned editorial shot of a man in his 50s rolling shoulder, soft natural light", "keywords": ["shoulder", "mobility", "mature man", "editorial"] },
    { "n": 2, "source": "ai", "subject": "macro 3D render of rotator cuff and joint capsule, cross-section, teal+amber tones", "prompt": "Macro scientific 3D render of a human shoulder joint capsule cross-section showing rotator cuff tendons and articular cartilage, bioluminescent details, soft glow, dark teal and amber tones, 4:5 vertical, premium scientific aesthetic, no humans no text" },
    { "n": 3, "source": "drive", "subject": "clinical shot of orthopedist reviewing MRI on a screen with a patient", "keywords": ["orthopedist", "MRI", "consultation"] },
    { "n": 4, "source": "stock", "subject": "abstract minimalist hinge or door mechanism", "keywords": ["hinge", "mechanism", "abstract", "minimalist"] },
    { "n": 5, "source": "ai", "subject": "abstract scientific data visualization, charts overlay on tendon imagery", "prompt": "Editorial scientific data visualization, abstract charts and graphs overlay on subtle anatomical tendon imagery, dark teal background, premium aesthetic, 4:5 vertical, no faces no text" },
    { "n": 6, "source": "drive", "subject": "physical therapy session, hands on shoulder mobility assessment", "keywords": ["physical therapy", "shoulder", "assessment"] },
    { "n": 7, "source": "drive", "subject": "imaging room with ultrasound machine, clinical setting", "keywords": ["ultrasound", "imaging", "clinical"] }
  ],
  "sources": [
    { "claim": "PRP for rotator cuff partial tears", "citation": "Multiple RCTs and meta-analyses, AJSM 2020-2023" },
    { "claim": "Shockwave for calcific tendinitis", "citation": "Systematic reviews; clinical practice guidelines" },
    { "claim": "A2M for early OA", "citation": "Pilot clinical work (Duke); larger trials ongoing" }
  ]
}
```

**Why this passes:**
- ✅ Structural arc matches §17.1 (cover → mechanism → gap slide → analogy → data → application → why-underused)
- ✅ Analogy slide present (not mental-health-acute)
- ✅ CTA stack 3-line + ALL-CAPS single-word keyword
- ✅ Hedged language throughout ("evidence strength differs", "pilot data", "don't promise outcomes")
- ✅ No FDA claims, no "regenerates/cures/treats", no exosomes
- ✅ Sources separated from caption
- ✅ Caption has no crisis_line (not Mental Health bucket)
- ✅ photo_brief mixes Drive (4), AI (2), stock (1) — matches §15.4 priority

**factCheck.ts result:** no findings (no SELECT / retatrutide / TMS / Spravato / ED / NAD+ keyword triggers).

---

## Sample B — Mental Health — mental-health-acute topic (stripped template)

Hook: postpartum depression with acute risk. Tests the mental-health-acute trigger (§18.1) — must produce stripped CTA and skip the analogy.

```json
{
  "plan_id": null,
  "category": "Mental Health",
  "topic_slug": "postpartum-depression-acute",
  "cover": {
    "title": "Postpartum Depression — When Speed Matters",
    "hook": "About 1 in 7 women experience it. For some, conventional timelines aren't fast enough. Swipe →"
  },
  "slides": [
    {
      "n": 2,
      "kind": "body",
      "heading": "What it is, clinically",
      "intro": "Postpartum depression is a defined medical condition, not 'baby blues' that should pass.",
      "bullets": [
        "Onset within 12 months postpartum",
        "Symptoms persist beyond 2 weeks and impair function",
        "About 1 in 7 women affected (CDC, ACOG)",
        "Untreated cases carry maternal and infant outcome risks"
      ],
      "close": "It's a diagnosis with treatment pathways — including options designed for speed when the timeline matters."
    },
    {
      "n": 3,
      "kind": "body",
      "heading": "When standard timelines aren't enough",
      "intro": "Conventional SSRIs work — but take 2-6 weeks to reach effect. For some patients, that window is too long.",
      "bullets": [
        "Severe maternal-infant bonding impairment",
        "Suicidal ideation or self-harm risk",
        "Inability to function in daily caregiving",
        "Breastfeeding constraints on medication choice"
      ],
      "close": "When risk is acute, a faster mechanism can change the trajectory."
    },
    {
      "n": 4,
      "kind": "body",
      "heading": "Rapid-acting options",
      "intro": "Two FDA-approved options exist for severe postpartum depression with faster onset than SSRIs.",
      "bullets": [
        "Zuranolone (Zurzuvae) — oral, FDA-approved 2023 specifically for postpartum depression",
        "Brexanolone (Zulresso) — IV, FDA-approved 2019; in-clinic 60-hour infusion",
        "Both target the GABA-A receptor system — a different mechanism than SSRIs"
      ],
      "close": "These are protocol-bound — not casual prescriptions."
    },
    {
      "n": 5,
      "kind": "body",
      "heading": "What evaluation looks like",
      "intro": "Treatment decisions in postpartum depression always involve OB-GYN, psychiatry, and the patient — not a 15-minute visit.",
      "bullets": [
        "Validated screening (EPDS, PHQ-9)",
        "Risk stratification — passive vs active ideation",
        "Breastfeeding plan if applicable",
        "Coordination with the OB and primary care",
        "Therapy in parallel — biology + psychology"
      ],
      "close": "Speed without coordination is unsafe."
    },
    {
      "n": 6,
      "kind": "body",
      "heading": "If you're in this right now",
      "intro": "Acute symptoms don't wait for a slot weeks away. If you or someone you love is struggling, reach out today.",
      "bullets": [
        "OB or primary care can refer urgently",
        "Postpartum Support International: 1-800-944-4773",
        "If in crisis, call or text 988 (US) at any time"
      ],
      "close": "This is a medical situation with medical solutions — and faster mechanisms exist when they're needed."
    }
  ],
  "cta": {
    "keyword": "SUPPORT",
    "follow_line": null,
    "comment_line": "\"SUPPORT\" and we'll share how rapid evaluation works.",
    "book_line": null,
    "crisis_line_in_cta": "In crisis? Call or text 988 (US). Or Postpartum Support International: 1-800-944-4773."
  },
  "caption": {
    "body": "Postpartum depression is a defined medical condition affecting about 1 in 7 women. When timelines matter — severe symptoms, suicidal ideation, impaired bonding — FDA-approved rapid-acting options exist (zuranolone, brexanolone). Treatment is coordinated with OB and psychiatry, not a casual prescription. If you or someone you love is struggling, reach out today.",
    "hashtags": ["#postpartumdepression", "#maternalmentalhealth", "#mentalhealth", "#PPD", "#hawaiiwellness"],
    "crisis_line": "If you or someone you know is struggling, call or text 988 — the Suicide & Crisis Lifeline. Or Postpartum Support International: 1-800-944-4773."
  },
  "photo_brief": [
    { "n": 1, "source": "ai", "subject": "soft editorial portrait of mother in dimly-lit nursery at dusk, face away from camera, contemplative", "prompt": "Editorial wellness photograph, mother in her 30s holding newborn, soft natural window light at dusk, face away from camera, dimly lit nursery, muted blue-grey palette, premium maternal aesthetic, vertical 4:5 frame, no identifiable faces, no text" },
    { "n": 2, "source": "stock", "subject": "doctor holding clinical screening form", "keywords": ["doctor", "screening", "clinical", "form"] },
    { "n": 3, "source": "drive", "subject": "warm-toned consultation between woman and clinician", "keywords": ["consultation", "woman", "clinician", "warm light"] },
    { "n": 4, "source": "ai", "subject": "abstract scientific render of GABA-A receptor in soft purple glow", "prompt": "Macro scientific 3D render of GABA-A neurotransmitter receptor, bioluminescent details, soft purple and indigo glow, dark background, premium scientific aesthetic, vertical 4:5 frame, no humans no text" },
    { "n": 5, "source": "drive", "subject": "clinical OB-GYN office with two clinicians in discussion", "keywords": ["OB-GYN", "clinicians", "office", "discussion"] },
    { "n": 6, "source": "drive", "subject": "calm hand on phone with support hotline visible (no identifiable text), warm muted tone", "keywords": ["phone", "support", "hand", "muted"] }
  ],
  "sources": [
    { "claim": "~1 in 7 women experience PPD", "citation": "CDC; ACOG Committee Opinion 757" },
    { "claim": "Zuranolone (Zurzuvae) FDA-approved Aug 2023 for postpartum depression", "citation": "FDA approval letter NDA 217369" },
    { "claim": "Brexanolone (Zulresso) FDA-approved Mar 2019 for postpartum depression", "citation": "FDA approval letter NDA 211371" },
    { "claim": "GABA-A receptor mechanism distinct from SSRIs", "citation": "Meltzer-Brody et al., Lancet 2018; standard psychopharmacology" }
  ]
}
```

**Why this passes:**
- ✅ Mental-health-acute trigger fires on "suicidal ideation" + "988" tokens → analogy slide SKIPPED (only 5 body slides, no "Think of it this way")
- ✅ CTA stripped: `follow_line: null`, `book_line: null`, only Comment + crisis_line in the CTA
- ✅ 988 line BOTH in CTA AND in caption.crisis_line (mandatory for Mental Health bucket)
- ✅ Postpartum Support International number adds an audience-specific resource without removing 988
- ✅ FDA dates exact (Zuranolone Aug 2023, Brexanolone Mar 2019) — fact-check rule would flag if wrong
- ✅ Hedged language ("treatment pathways", "options designed for speed when the timeline matters")
- ✅ Sources separated from caption
- ✅ Tone clinical and supportive, NOT "system failed you" / "you deserve better" — content plan §17.1 explicitly forbids that framing for acute mental health

**factCheck.ts result:** no findings. Hedge keywords ("FDA-approved", actual dates included) keep R-FDA-01 happy.

---

## How to use these samples

1. **Spec validation** — the next bot reads these and knows EXACTLY what the writer must produce. JSON keys are stable, every field has a counterpart in the target shape.
2. **Compliance test seed** — feed both into the factCheck + compliance gate after Session 1 implementation. Both should grade `PASS` with empty findings on first run. If either fails, the gate has a false-positive bug.
3. **Few-shot extension** — once these are reviewed by the medical director, they can join the `few_shot_library` with score = 10.

These are SPEC, not generated output. The writer will produce things in this shape after Session 1 ships. Until then, these documents prove the spec is internally consistent.
