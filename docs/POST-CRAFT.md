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
- **Photo-in-photo** — a smaller framed inset image (rounded rect, thin border
  or soft shadow) layered over the main background, showing the concrete thing
  the slide names (organ render, device macro, patient moment). Draws from the
  same photo direction (§5); prefer a **stock macro** for the inset when the
  main is AI (helps hit the 60/40 mix). Keep it to one inset, off the text
  panel, aligned to a corner or the upper third.

Ideas bank to keep exploring (Igor, "подумай что ещё"): a boxed "Fig." caption
under an inset, a two-column split (photo left / text right), an accent colour
block behind a single word, a big drop-cap opening a prose slide, a subtle
grain/newsprint texture on an editorial slide. Try one per post, never all.

---

## 5. PHOTO DIRECTION (binding — v2 + 60/40)

Aesthetic-first, people-light. See `lib/posts/photo-brief.ts` for the machine
rules; the human/runner rules:

- **Default visuals** = premium **3D medical renders** (organs, molecules,
  processes — glass-like translucent, deep teal + warm amber glow) and **Hawaii
  nature / abstract organic** detail. NOT people.
- **People**: max 2 slides per post (0 is fine), only **outdoor Hawaii**
  locations, full figure, medium-wide. The **cover is NEVER a close-up face**.
- **Mix: ~60% AI-generated / ~40% stock** across a post (Igor 2026-07-28).
  Stock = real-object macro (device, injection pen, vials) or aesthetic nature;
  never stock people. Use stock especially for the concrete/device and
  photo-in-photo insets; AI for renders and Hawaii scenes.
- Flux `black-forest-labs/flux-1.1-pro-ultra`, 4:5, safety_tolerance 6.
- Every AI prompt keeps "dark lower third" (the teal text panel overlays there).
- **Visual review every image** before upload; reject: close-up-face covers,
  visible AI artifacts (hands, waxy skin), unbudgeted people, swimwear, text in
  image, or a reused example-design background repeating across posts.

---

## 6. WORKFLOW NOTE

Text (voice + shape + spacing) comes from the **writer/splitter prompts**
(`lib/agents/writer.ts`, `lib/posts/splitter.ts`). Visual assembly + design
elements + panel-fit come from the **Canva compose-runner**
(`~/.claude/skills/canva-compose-runner/SKILL.md`), which copies a style example
and swaps photos + text only. Server-side Canva autofill does NOT work — see
`HANDOFF-MODULES.md`. Perfect a post by hand first, then promote its patterns
into these two places so the machine reproduces them.
