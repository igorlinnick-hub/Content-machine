# POST-CRAFT — the craft bible for HWC carousels

**Binding for every bot that touches a carousel** (writer, splitter, photo-brief,
Canva compose-runner) and for any human/Claude tuning a post by hand. When this
conflicts with an older note, this wins. Source of the rules: Igor's direct
tuning sessions, 2026-07-23 → 2026-07-28.

The job: each post must read like a **real doctor teaching one patient**, look
like a **premium editorial carousel**, and never like an AI template
("заготовка"). Depth and specificity always beat brevity.

---

## 1. VOICE & TONE (binding)

Write like the doctor is talking to **one** patient across the table — clear,
warm, genuinely useful, a little surprising. Educational, **never** scolding,
alarmist, or superior.

- Name the hard part (what hurts, what didn't work) to help the reader
  **understand** it — never to indict their old doctor or scare them.
- Every slide turns toward **what it means** and **what's possible next**.
  Encouraging, not hype.
- Keep pain honest but land on possibility. "с позитивным настроем, не через чур."

### Sound human, not AI — banned patterns

These are the tells that make copy read machine-made. Avoid them:

- **Rule-of-three abstract-noun lists** — "gut receptor sensitivity, liver
  clearance rate, and lean muscle mass all change how the drug behaves."
  → Pick ONE concrete thing, make it real: "if you've lost muscle over the
  years, the same dose can hit you harder."
- **The tidy antithesis "summary bow"** — "Same drug, same schedule — very
  different outcomes", "It's not X, it's Y", "The problem was never A — it's B."
  The #1 AI tell. **At most one** such line in a whole post, if any.
- **Filler / throat-clearing** — "significantly", "varies significantly",
  "plays a key/crucial role", "it's important to note", "when it comes to",
  "isn't uniform", "in many cases." Cut them; say the concrete thing.
- **Perfectly parallel, symmetric prose.** Real speech is uneven — a 3-word
  sentence next to a 20-word one. Use contractions and plain verbs.
- **Ending every slide on a neat wrap-up.** Sometimes just stop on the useful
  detail.

One small, specific, human observation beats three polished generalities.

### Never

- No "Swipe →" or any swipe prompt anywhere (the platform UI handles it).
- No invented statistics/percentages. If a number isn't in the verified facts,
  write "studies report improved outcomes for many patients."
- Keep the plan-assigned ManyChat **KEYWORD** exactly (binding, from the curated
  list). Never substitute or invent.

---

## 2. SLIDE-SHAPE CATALOG — vary every slide

**Rule: never two consecutive slides in the same shape.** The reader must feel a
change of pace on every swipe. This governs SHAPE, not LENGTH — keep every
mechanism, number, and named study intact. Pull from these shapes:

| Shape | What it is | Use for |
|---|---|---|
| **Cover hook** | Title + a curious/warm 1-2 line hook (no antithesis) | Slide 1 |
| **Mechanism** | Heading + lead-in + real biology in sub-points + close. The DEEPEST slide — never thin it | "What's happening" / real cause |
| **Comparison** | Two labeled sides stating real facts: `Cortisone → calms pain fast, doesn't touch the cause` / `A2M → targets the enzymes` | Standard-care vs. approach; drug A vs B |
| **Research statement** | Each named study as ONE crisp line, not a paragraph: "STEP trial: weight change over 68 weeks under supervision" | "What the data shows" |
| **Analogy + takeaway** | A sticky plain-prose analogy, a divider, then a bold one-line takeaway | "Think of it this way" |
| **Checklist** | Lead-in + `✓` items with breathing room + close | "Who this helps" / candidacy |
| **Numbered path** | `①②③` steps with thin dividers between them | "Your next step" / protocol |
| **Single vivid line** | One short, warm paragraph, nothing else | Sparse beats, palate cleanser |
| **Pull-quote (editorial)** | A short claim set large with a kicker label + rule, magazine style | A punchy reframe, a myth line |

A carousel = cover + **at least 4 body slides** + CTA. Fewer body slides = failed.

---

## 3. SPACING & SEPARATION (binding — Igor 2026-07-28)

The #1 layout defect is a **wall of stacked lines with no air**. Prescribe
spacing explicitly:

- **A blank line between every distinct item** — between the lead-in and the
  list, between each `✓` / `①` item, and before the closing line. Never let
  sentences pile up with no gap.
- Sub-points get a real marker: `✓ ` for checklists, `① ② ③` for steps,
  `→` for comparisons. Use **literal characters**, and set
  `format_text {list_level:0, list_marker:"none"}` so Canva doesn't add its own
  bullet (blank lines inside a native list render as empty bullets).
- A **thin horizontal divider line** (1-2px, panel-text colour at ~40-60%
  opacity, ~70% panel width, centered) between numbered steps or between an
  analogy and its takeaway. Subtle, not heavy.
- **Bold** the payoff line (takeaway, "No pressure. Just clarity.") via
  `format_text` — one bold accent per slide, max.

If a slide's text looks compressed on export, add the blank lines and re-export.
"Красота" bar: the enriched slides 4/6/7 of DAHQnsEktf0 (2026-07-28) are the
reference for spacing done right; slide 5 pre-fix is the wall to avoid.

---

## 4. DESIGN ELEMENTS — fill space, add divisions

A slide with little text must NOT be one floating panel over dead space. Enrich:

- **Thin divider rules** between sub-points (see §3).
- **Numbered badges** `①②③` for a path/steps.
- **Checkmarks** `✓` for candidacy.
- **Bold takeaway** line separated by a divider.
- **Reposition + grow the panel** so it sits balanced (usually lower ~55-65%)
  and hugs its content — no big empty coloured void, and panels must NOT all be
  the same height across the post.
- **Pull-quote / editorial (magazine/newspaper) treatment** — for a punchy
  reframe: a small ALL-CAPS **kicker label** ("THE CATCH", "WHAT WE SEE"), a
  large short quote, a hairline rule under it, optionally oversized quotation
  marks. Gives a premium editorial feel and breaks the panel monotony.
- **Highlight-marker** (Igor 2026-07-28, likes it) — set ONE key heading or
  one-line statement over a solid **brand-teal highlight block** behind the
  text, like a highlighter swipe (ref: the "Lorem Ipsum" yellow-marker look, but
  in HWC teal, not yellow). One punch line per post, max.
- **Semi-transparent rounded elements are the house look** (Igor likes them):
  soft translucent rounded panels / colour shapes in brand colour. Prefer these
  over hard opaque boxes. The slide-4 translucent panels are the reference.
**REMOVED — extra images are OUT of the chain (Igor 2026-07-29).** Photo-in-photo
insets, edge-placed 3D cutouts, and split / two-image layouts are banned — they
came out crooked, ugly, or blank (NAD+ p4 split + p7 blank-label). Use **exactly
ONE full-bleed background image per slide, nothing layered on top.** The
TEXT/decor elements above (dividers, ✓, ①②③, kicker, bold takeaway,
highlight-marker, translucent panels) are what Igor likes — extra IMAGES are not.

Ideas bank (TEXT/decor only — no extra images): an accent colour block behind a
single word, a big drop-cap opening a prose slide, a subtle grain/newsprint
texture on an editorial slide. Try one per post, never all.

Reference (2026-07-28, "красота"): DAHQnsEktf0 slides — 7 (`①②③` numbered path
+ dividers), 6 (`✓` checklist), 4 (analogy + divider + bold takeaway), 3
(kicker + comparison). Copy those layouts (text/decor only).

### 4a. ADAPTIVE FILL — by slide type (binding, Igor 2026-07-29)

When a slide has little text and leaves empty space, DON'T leave a dead panel.
Decide by slide type (in this order of preference):

| Slide type | Fill it with |
|---|---|
| Mechanism / biology | denser text is fine (keep depth) + on-topic render; no gap |
| Comparison | two labeled sides + hairline divider between them |
| Research / "data shows" | 2-3 spaced research lines + a device/real-photo edge inset |
| Analogy | short analogy + divider + **bold takeaway** line |
| Candidacy / "who it's for" | `✓` checklist with blank-line spacing |
| Next step / protocol | `①②③` numbered path with thin dividers |
| Sparse / palate-cleanser | one vivid line + a real Hawaii photo filling the frame |

Rules: (1) **never a large empty coloured void** — grow the panel to hug content
or add ONE element; (2) more text is acceptable to fill space (Igor) as long as
depth/specificity aren't sacrificed and it's not padding; (3) **~one special
element per post**, not on every slide; (4) vary — no two consecutive slides the
same shape or layout.

---

## 5. PHOTO DIRECTION (binding — v3, 2026-07-29; supersedes v2)

**CONTEXT-FIRST, real Hawaii, people welcome.** v2 was "aesthetic-first,
people-light" — v3 corrects it: every image must MATCH what the slide is about,
real-photo looks beat abstraction, and people are fine. See
`lib/posts/photo-brief.ts` for the machine rules; the human/runner rules:

- **Context is the #1 rule.** The image shows the slide's actual subject — a
  joint slide shows a joint, a drug slide shows the pen/vial, a decision slide
  shows a real person or place. If you can't say in one line how the image
  relates to the copy, it's wrong.
- **BANNED: abstract backgrounds** — gold-crystal, marble, generic "organic
  texture" (the DAHQuMaSYFI p3/p4 anti-pattern). They read as filler.
- **Source priority:** real photo (photoreal) → contextual 3D render → nothing
  abstract. Three kinds of image:
  - **RENDER** (AI) — 3D medical viz of the named organ/molecule/process. For
    mechanism / biology / "what it is".
  - **PEOPLE** (AI or stock) — Native Hawaiian/Polynesian, natural Hawaii scene,
    full figure or upper body, **face NEVER close to camera**. WELCOME on up to
    **~half the slides** (patient story, candidacy, emotional beats).
  - **STOCK / photoreal** — a real-photo look: device macro (pen/vial/coil), a
    real Hawaii place (coastline, ocean, palms, volcanic rock), or a candid
    person. Carries the ~40% real-photo share.
- **Mix: ~60% AI (renders + AI people) / ~40% stock (photoreal real photos).**
  Enforced in code by `balanceAiStock`.
- **Stock = real photos from Pexels (Igor 2026-07-30).** The Canva MCP has no
  stock-search tool, so the runner fetches real stock from the **Pexels free
  API** (`PEXELS_API_KEY` in the runner env) by the slide's keywords, and only
  falls back to photoreal Flux if the key is missing or nothing fits. Prefer
  REAL photos over AI everywhere a photo works (people, Hawaii places, devices);
  reserve AI for the 3D medical RENDERS only.
- **Cover (page 1): NO photo.** Keep the template's clean branded cover
  (gradient / brand surface), like the old designs — never inject a photo or
  render on the cover (Igor 2026-07-30). Only the cover text changes.
- Flux `black-forest-labs/flux-1.1-pro-ultra`, 4:5, safety_tolerance 6. Every AI
  prompt keeps "dark lower third"; PEOPLE also "subject in upper two-thirds".
- **Device photos:** no blank white label placeholders (the NAD+ p7 bug) — prompt a label-less bag/bottle or a drip-chamber / IV-line / hand-holding-pen close-up, not a front-on labelled bag.
- **Visual review every image**; reject: abstract/off-topic backgrounds,
  close-up-face covers, AI artifacts (hands, waxy skin), swimwear, text in image,
  a reused example-design background repeating across posts.

---

## 6. WORKFLOW NOTE

Text (voice + shape + spacing) comes from the **writer/splitter prompts**
(`lib/agents/writer.ts`, `lib/posts/splitter.ts`). Visual assembly + design
elements + panel-fit come from the **Canva compose-runner**
(`~/.claude/skills/canva-compose-runner/SKILL.md`), which copies a style example
and swaps photos + text only. Server-side Canva autofill does NOT work — see
`HANDOFF-MODULES.md`. Perfect a post by hand first, then promote its patterns
into these two places so the machine reproduces them.
