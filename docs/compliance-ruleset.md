# Content Compliance Ruleset — HWC social posts (captions + video)

`ruleset_version: 2.1` · created 2026-06-09 · status: **DRAFT — counsel review required**

> **PRIVILEGE / WORK-PRODUCT.** This document and any verdicts generated from it are
> intended as a **compliance self-assessment prepared for review by the clinic's medical
> director and legal counsel**. It identifies **potential** issues *for counsel
> determination* — it does **not** adjudicate legality. Treat as confidential
> attorney-directed work-product; do not distribute outside the review circle. (Council
> blind-spot: an undated, unprivileged "we knew it was illegal" log is discoverable and can
> evidence scienter — the opposite of a good-faith program. Hence the careful framing,
> dating, and review cadence below.)

**Read this file BEFORE any analysis or auto-grading of content.** This is the formal ruleset:
`compliance_analyze.py` feeds the entire file to Claude as a prompt, and the judge MUST
reference only `rule_id` values from here and quote evidence verbatim.

⚠️ **This is NOT legal advice.** The output is a map of *potential* risks for the medical
director and legal counsel (Constitution §4). It does not replace a healthcare attorney.

This is the **FDA/FTC enforcement layer**. The marketing-channel framework (Meta ad policy,
IG community guidelines, HIPAA/Pixel) lives in
[regenerative-medicine/05-compliance.md](regenerative-medicine/05-compliance.md) and is
**cross-referenced, not merged**.

`review_cadence:` re-validate within 90 days or on any FDA/FTC guidance change or new
service offering (compliance is a moving target — a frozen ruleset silently rots).

---

## 0. Calibration principle (READ FIRST — balanced, not alarmist)

Goal is **clarity on what is OK vs not OK**, not fear. Do NOT flag a post just because a
clinical word appears — only when a **claim** crosses a rule. But read the way a regulator
does: **net impression of the whole post** (caption + spoken video + hashtags), not isolated
sentences.

- `REMOVE` = genuine high-risk: efficacy/structure-function/disease claim about a not-approved
  product, exosomes offered as therapy, false "FDA-approved", guarantees.
- `REWORD` = fixable by wording; post can stay after the edit.
- `REVIEW` = **uncertainty / needs a human** (NOT a severity level — it means "I'm not sure,
  look at this"). Use it for borderline, disclaimer-needed, conflicting rules, or uncovered
  claims.
- `PASS` = no claim crosses a rule (pure education, pure experience, promo, brand). Most posts.

When genuinely unsure between actions, pick **REVIEW** (let the human decide) — except where a
rule says otherwise (exosomes → REMOVE).

---

## 1. Authorities (why these rules exist)

- **FDA — unapproved products & "claims".** Stem cells, exosomes, biologics, BMAC, PRP used
  beyond minimal-manipulation/homologous use are biological *drugs*. The claim net is **broad**:
  not only disease treatment but **structure/function** ("rebuilds cartilage", "regenerates
  tissue", "restores nerve function"), **symptom** ("eliminates pain/numbness"), and
  **anti-aging/longevity** ("reverses aging", "turns back the clock") claims — this is exactly
  the language FDA warning letters & injunctions against stem-cell/exosome clinics cite.
- **FDA — exosomes.** Public safety notification (Dec 2019): **no** FDA-approved exosome
  products. Marketing exosome "therapy" is a known enforcement target.
- **FTC — substantiation.** Health-outcome claims need "competent and reliable scientific
  evidence". Unsubstantiated = deceptive. FTC has sued stem-cell clinics.
- **FTC — testimonials & endorsements (16 CFR Part 255, updated 2023).** Net-impression rule:
  a testimonial may not convey a claim the advertiser couldn't make directly — **even with no
  product word** — and the advertiser **cannot make through an endorser any claim it couldn't
  substantiate directly** (§255.1(c)). **CRITICAL (council/source-verified):** the 2009 Guides
  **removed the "results not typical" safe harbor** — a "results vary" disclaimer does **NOT**
  cure an unsubstantiated typical-results claim; you must substantiate AND disclose generally
  expected results. For an unapproved-product efficacy claim, no disclaimer cures it — don't make
  the claim. **Material connections** (employees, paid/affiliated, free/discounted treatment)
  must be disclosed (§255.5).
- **FTC — Fake Reviews Rule (16 CFR Part 465, 2024).** Bans fake/AI-generated reviews,
  incentivized reviews conditioned on sentiment, undisclosed insider/employee reviews, and
  review suppression (soliciting/gating only positive reviews). Civil penalties.
- **FDA — "cleared" ≠ "approved".** 510(k) **cleared** devices (e.g. TMS/ExoMind) are not
  "FDA-approved"; claims must stay within the exact cleared indication (TMS: depression/OCD, not
  "focus/mood/wellness").
- **FDA — enforcement-discretion period ENDED May 31, 2021.** No grace period for unapproved
  HCT/Ps. Settled case law: US Stem Cell (11th Cir. 2019), California Stem Cell Treatment Center
  (9th Cir. 2024, SCOTUS cert denied 2025).
- **State medical board** advertising rules — no false/misleading representation; supervising
  physician named where required.

> **Note on PRP (source-verified):** PRP is generally a Section **361** HCT/P / blood-derived
> product, NOT a §351 biologic — don't lump it with exosomes/MSCs as a "drug". But "autologous"
> alone is not a safe harbor: any HCT/P becomes a §351 drug if **more-than-minimally manipulated**
> OR used **non-homologously** (the SVF case).

---

## 2. Verdict vocabulary

`REMOVE` · `REWORD` · `REVIEW` · `PASS` — exactly one post-level action (see §4 precedence).

## 2a. Scope of automated grading (what the judge sees vs not)

- **In scope:** caption text, **hashtags**, **bio context**, and the **video transcript**
  (spoken claims count exactly like written ones). Feed all of these.
- **OUT of automated scope (manual review required):** **images / before-after visuals /
  on-screen text in video**. A glowing before/after photo can be the strongest claim on the
  page and the text judge cannot see it. Any post whose visual may carry a claim → the human
  reviewer must inspect. The PDF must state this limitation.
- **Also out of this batch's scope but governed by the same rules (council gap):**
  **comments, DMs, Manychat auto-replies, Stories/Highlights, and linked landing pages.** The
  highest real-world risk is a staffer replying "yes it cured my knee" in a comment/DM. The team
  playbook covers these; a future pass should grade Manychat templates + linked pages.

---

## 3. Hard rules

Format: `rule_id | claim type | trigger | default action | rationale (authority)`

### Stem cells — `R-SC`
- `R-SC-01` | stem-cell **efficacy / structure-function / symptom / anti-aging** claim |
  states/implies stem cells improve a condition, reduce inflammation, **regenerate/restore
  tissue or function**, **reverse aging**, relieve a symptom, etc. | **REMOVE** | unapproved
  biologic-drug claim — broad FDA net (FDA).
- `R-SC-02` | stem-cell **disease/condition target** | names a condition stem cells treat
  (knee arthritis, MS, ED, neuropathy…) | **REMOVE** | disease-treatment claim, unapproved (FDA).
- `R-SC-03` | stem-cell mention, **pure mechanism education**, NO outcome/structure-function/
  disease claim and NO testimonial efficacy | **REVIEW** | low risk but drifts; human glance.

### Exosomes — `R-EXO`
- `R-EXO-01` | exosome **offered as therapy/treatment/program** | **REMOVE** | FDA safety
  notification, no approved products — "unsure → REMOVE" here.
- `R-EXO-02` | exosome named in **pure science education, not offered** | **REVIEW**.

### Biologics / BMAC — `R-BIO`
- `R-BIO-01` | biologics/BMAC efficacy/structure-function claim or results testimonial |
  **REVIEW** | same FDA bucket as stem cells, but often autologous/same-day → may be
  practice-of-medicine; human + reword, not auto-removal.
- `R-BIO-02` | biologics/BMAC named, NO outcome claim | **PASS/REVIEW**.

### PRP — `R-PRP`
- `R-PRP-01` | PRP efficacy hedged ("may help", "supports natural healing") | **REVIEW**.
- `R-PRP-02` | PRP stated to treat/cure a disease, restore structure, or with a success stat |
  **REWORD**.

### "FDA-approved" truthfulness — `R-FDA`
- `R-FDA-01` | "FDA-approved" on a product NOT approved for that indication (stem cells,
  exosomes, PRP, most devices, **compounded** semaglutide/tirzepatide) | **REMOVE** | false/
  misleading (FTC+FDA).
- `R-FDA-02` | "FDA-approved" on a genuinely approved drug for its approved use (brand
  Ozempic/Wegovy/Mounjaro/Zepbound; Spravato/esketamine) | **REVIEW** | likely true — verify
  it's the brand, not compounded.

### Substantiation / success stats — `R-SUB`
- `R-SUB-01` | numeric efficacy stat ("85% success", "thousands recovered") | **REWORD** |
  needs evidence on file (FTC).
- `R-SUB-02` | "clinically proven", "scientifically proven", "shown to [treat/reduce]" |
  **REWORD** | proof-level claim needs substantiation (FTC).

### Guarantees — `R-GUAR`
- `R-GUAR-01` | "guaranteed", "100%", "permanent", "lasting results", "cure" tied to a medical
  outcome | **REMOVE** | outcome guarantees deceptive for medical services (FTC).

### Testimonials — `R-TEST` (net-impression aware)
- `R-TEST-01` | **pure-experience** testimonial — personal experience/feelings/service ("I felt
  cared for", "the staff was great", "I'm glad I came") with NO efficacy claim AND the post is
  NOT promoting a specific unapproved product | **PASS** | legal personal endorsement (255).
- `R-TEST-02` | **efficacy** testimonial about an **unapproved** product (stem cells, exosomes)
  — patient/caption attributes a medical outcome to the therapy | **REMOVE** | launders an
  unsubstantiated unapproved-product claim (255 + FDA).
- `R-TEST-03` | efficacy testimonial about **lower-risk/autologous** therapy (PRP, biologics,
  IV, NAD+, ketamine) with NO "results vary" disclosure | **REVIEW** | needs disclosure/
  substantiation; reword not remove (255).
- `R-TEST-04` | any testimonial implying **typical** results without a disclosure | **REVIEW** |
  typicality rule (255).
- `R-TEST-05` | **proximity / net-impression** — an experiential testimonial (even with no
  product word, e.g. "I can finally walk my dog again", "I got my life back") that appears
  **inside/alongside content promoting an unapproved product** (stem cells/exosomes named in the
  same caption, hashtags, or video) | inherits that product's action → **REMOVE**; if the
  adjacent product is lower-risk → **REVIEW** | regulators read net impression, not keywords (255).
- `R-TEST-06` | testimonial/endorsement from an **employee, paid, or materially-connected**
  person, or where the patient received **free/discounted** treatment, **without disclosure** |
  **REVIEW** | material-connection disclosure (255.5).

### Disease / structure-function (non-stem) — `R-DIS`
- `R-DIS-01` | a therapy is stated to **treat/cure/reverse a named condition, restore a body
  structure/function, or eliminate a symptom**, where that use is not established/approved |
  **REWORD** | broad-claim doctrine; soften to education or substantiate (FDA/FTC).
- `R-DIS-02` | condition-awareness without a treatment promise ("Chronic knee pain limits daily
  life — learn about options") | **PASS** | allowed framing.

### Off-label drugs — `R-OFL`
- `R-OFL-01` | ketamine presented as **approved** treatment for depression/PTSD/anxiety/pain |
  **REWORD** | only Spravato (esketamine) is approved; IV ketamine is off-label → frame as
  off-label, physician-supervised.
- `R-OFL-02` | compounded GLP-1 (semaglutide/tirzepatide) implied FDA-approved, **or** marketed
  on "no shortage / always available" supply claims | **REMOVE** | compounded versions not
  approved; post-2024 FDA crackdown on compounded GLP-1 (overlaps R-FDA-01).
- `R-OFL-03` | superlatives ("breakthrough/revolutionary/miracle/cutting-edge") **attached to a
  health/efficacy claim** | **REWORD** | implies unsubstantiated efficacy edge (FTC). **NOTE:**
  a bare superlative with NO health claim (e.g. "our beautiful new clinic", brand tone) is
  permissible puffery → **PASS** (do not over-flag).

### Reviews / endorsements integrity — `R-REV`
- `R-REV-01` | fake / AI-generated / employee-as-customer review, incentivized-on-sentiment
  review, or gating/suppressing to show only positives | **REMOVE** | FTC Fake Reviews Rule
  (16 CFR Part 465) — civil penalties.

### Devices — `R-DEV`
- `R-DEV-01` | a 510(k)-**cleared** device described as "FDA-approved", or claimed beyond its
  cleared indication (e.g. TMS/ExoMind for "focus/mood" vs cleared depression/OCD) | **REWORD** |
  cleared ≠ approved; intended-use overreach = misbranding.

### Catch-all — `R-MISC`
- `R-MISC-01` | a health/efficacy **claim the rules above don't clearly cover** | **REVIEW** |
  nothing exits unscored; human decides.

---

## 4. Precedence (combining fired rules into ONE post action)

1. If **any** fired rule → `REMOVE` ⇒ post = **REMOVE**.
2. Else if any → `REVIEW` ⇒ post = **REVIEW**.
3. Else if any → `REWORD` ⇒ post = **REWORD**.
4. Else → **PASS**.

Overrides / nuances:
- `R-TEST-01` (pure experience, no adjacent unapproved product) never by itself exceeds `PASS`.
- `R-EXO-01` always wins to `REMOVE`.
- Category-keyword-only (e.g. `R-SC-03`, `R-BIO-02`) never exceeds `REVIEW`.
- **Compounding:** if **≥2 independent** REWORD/REVIEW-level claims co-occur in one post
  (e.g. a hedged PRP claim **and** a testimonial **and** a superlative), escalate the post one
  level (REWORD→REVIEW, REVIEW→REMOVE is NOT automatic — cap at REVIEW unless a REMOVE rule
  fires). Regulators read accumulation as a pattern.
- Evidence may come from caption, hashtags, bio, **or video transcript** — record
  `evidence_source`. A spoken claim counts the same as written.
- If the judge cannot produce a **verbatim** substring for a non-PASS verdict, the analyzer
  forces the post to `REVIEW` + `human_flag` (anti-hallucination linter).

---

## 5. Reword templates (Bad → Good)

| Bad | Good |
|---|---|
| "Stem cells regenerated my cartilage / restored my mobility" | "Patients explore regenerative options for joint health — individual results vary; ask if you're a candidate" |
| "Reverses aging at the cellular level" | "Supports cellular wellness as part of a longevity-focused plan" |
| "We offer exosome therapy" | (remove — no compliant public framing pending counsel) |
| "FDA-approved stem cell treatment" | "Evidence-informed regenerative protocols" |
| "85% success rate" | (remove the stat, or "in a published study of X, …" with citation on file) |
| "Ketamine — FDA-approved for depression" | "Physician-supervised ketamine therapy (used off-label for mood); Spravato is the FDA-approved esketamine option" |
| "Guaranteed lasting relief" | "Many patients report relief; individual results vary" |
| "I can finally walk again" (beside stem-cell post) | (remove the efficacy implication OR detach from the unapproved-product context + add "results vary") |

---

## 6. Output contract (per post)

```json
{
  "post_id": "…", "permalink": "…",
  "action": "REMOVE|REWORD|REVIEW|PASS",
  "triggered_rule_ids": ["R-…"],
  "reason": "plain-English, ≤2 sentences, framed as a POTENTIAL issue",
  "risky_quote": "verbatim substring of caption/transcript (empty if PASS)",
  "evidence_source": "caption|transcript|both|none",
  "is_testimonial": true,
  "testimonial_type": "pure_experience|efficacy_claim|proximity|null",
  "recommended_fix": "concrete reword, or 'remove', or ''",
  "ruleset_version": "2.0"
}
```
Judge rules: cite only `rule_id`s that exist here; `risky_quote` must be an exact substring of
the supplied text (no paraphrase); read net impression; be balanced per §0; phrase `reason`
as a *potential* issue, never a legal conclusion.

---

## 7. Out of scope for THIS pass (council roadmap → v2.1+)

These came out of the llm-council pressure-test and are real, but deliberately deferred so the
backlog grading ships:
- **Account-level / pattern aggregation** — many individually-PASS posts can collectively
  position an unapproved therapy as a cure. Add a summary layer that scores the *account*.
- **Pre-publish gate** — wire the judge into the content pipeline so violations never ship
  (prevention > cleanup).
- **Lawyer-validated gold set** — hand-label ~30 posts with counsel, measure judge recall on
  REMOVE/REWORD (target ≥95%) before fully trusting automated output.
- **Visual/OCR grading** — extend beyond text to before-after images & on-screen text.
- **Generative compliant rewrites + counsel-override feedback loop** — only AFTER the judge is
  validated (auto-rewriting from a miscalibrated judge scales risk).

---

## Changelog
- **v2.1 (2026-06-10)** — second llm-council pass with **web source-verification** of every
  citation (all confirmed correct). Fixes: killed the "results vary disclaimer cures it" myth
  (2009 Guides removed that safe harbor); added FTC Fake Reviews Rule (R-REV-01, 16 CFR 465);
  added cleared≠approved device rule (R-DEV-01); PRP = 361 not 351 + "autologous ≠ exempt" note;
  added §255.1(c) substantiation prong; noted enforcement-discretion ended May 2021 + case law;
  expanded scope note to comments/DMs/Manychat/Stories/linked pages. Team playbook
  `docs/clinic-handoffs/content-compliance-playbook.md` updated to v1.1.
- **v2.0 (2026-06-09)** — applied llm-council pressure-test. Key fixes: broadened the claim net
  to structure-function/symptom/anti-aging (R-SC-01, R-DIS-01); added testimonial net-impression
  proximity rule (R-TEST-05) and material-connection disclosure (R-TEST-06); fixed superlative
  over-flagging (R-OFL-03 now requires an attached health claim); extended compounded-GLP-1 to
  supply claims (R-OFL-02); added catch-all (R-MISC-01); clarified REVIEW = uncertainty not
  severity; added compounding rule; defined automated scope (hashtags/bio in, visuals out);
  added privilege/work-product framing + review cadence (discoverability blind-spot). Deferred
  items in §7.
- **v1.0 (2026-06-09)** — initial formal ruleset; superseded the keyword-only first pass.
