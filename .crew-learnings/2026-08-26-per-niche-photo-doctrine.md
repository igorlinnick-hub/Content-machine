# Per-niche photo doctrine (2026-08-26)

**Pattern:** the photo brief agent (`lib/posts/photo-brief.ts`) and the compose-time
cover rewrite (`lib/posts/cover-brief.ts`) now select a *doctrine* by `clinics.niche`
instead of one hardwired look. A doctrine = system prompt + verbatim Flux style lines
per mode + mix numbers (clinic share, floor-or-ceiling, Pexels cap) + two predicates
(`hasStyleLine`, `isPremium`) + a subject→style-line fallback.

**Why it was needed:** two clinics (regenmed + aesthetics) shared one Drive folder and
one prompt, so every post — jawline lines or NAD+ — opened on the same 3D organ and the
same desk photo. Igor: "для всех примерно одно и то же".

**Aesthetics specifics worth reusing elsewhere:**
- The no-face rule is *structural*, not a negative prompt — and stricter than it
  looks. Measured on Flux 1.1 pro ultra: "cheek/jawline cropped below the eye line"
  → nose + lips; "the jaw seen from BEHIND, head turned away" → a lip-and-nose
  profile. Any facial word in the prompt yields a face. So SKIN prompts name only
  non-facial areas (neck from behind, shoulder, décolleté, forearm, back of hand),
  and face-region topics (forehead, 11s, lips, jawline…) go to the instrument still
  life or the room instead.
- Instruments are still life only — never entering skin, no blood. Meta ad policy +
  compliance both dislike mid-injection shots.
- Clinic share is a *ceiling* for this niche (`capClinic`), because the library is the
  other niche's team shots. A floor-only share would pull them in anyway.
- The `normaliseBrief` guard re-appends the style line when the LLM dropped it — that
  is where the no-face / no-text guards live, so a bare prompt is a real risk.

**Where the numbers live:** regenmed 40% clinic floor / stock ≤2; aesthetics 25% clinic
ceiling+floor / stock ≤2. Grade: regenmed teal+amber, aesthetics warm-neutral + lavender
(matches the Aesthetic master's translucent purple panels).

Docs: `docs/POST-CRAFT.md §5a`, runner `SKILL.md §4` addendum, `HANDOFF-MODULES.md`.
