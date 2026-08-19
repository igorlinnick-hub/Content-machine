# UFC GYM Partner — Repeat Cash Commission Schedule

HWC-branded 3-page PDF listing every service a UFC GYM trainer can refer and what
each one pays. Extends the original 8-bucket "What you can earn" panel in the
UFC Trainer Partner Guide into the full catalog, at CRM-tag granularity.

## Build

```bash
node inline-fonts.mjs   # fetches Playfair Display + Inter, writes fonts.css (base64, ~435 KB)
node build.mjs          # writes commission-schedule.html (fonts + logo inlined)

/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu \
  --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=HWC-UFC-Commission-Schedule.pdf commission-schedule.html
```

`fonts.css` is generated, not committed. The logo is read straight from
`public/brand/hwc-logo.png`. Output is fully self-contained — no external requests.

## How the payouts were derived

Source of truth: `master-pricelist.json` — the MASTER HWC Pricelist transcribed from
screenshots (6 sheets, 118 services). Retail / member / veteran for every line.

**One CRM tag = one service name = one flat fee.** No dosages, no unit counts, no
package variants — names are stripped to what the clinic actually tags on
(`Nano AER`, not `Nano AER (50bil)`), and a course of treatment tags as the service
and pays the service rate. 33 tags across 8 categories.

Rate: **~10% of standard price**, snapped to a clean tier
($25 / 50 / 75 / 100 / 150 / 200 / 250 / 300 / 500), $25 floor.

### Why 10%

The clinic already gives **up to 50% off for veterans** (Pain & Joint: 20%). That
discount is proof of the margin the business can absorb and still work. The referral
fee is set at a fraction of that headroom — roughly a fifth on most services — rather
than anywhere near the top of it. The veteran discount sets the ceiling; it is not
the target.

Two v1 numbers already sat at exactly 10% of retail (Myer's Cocktail $246 → $25,
Nano Exosomes $5,000 → $500), which corroborated 10% as the intended basis.

Retail is the basis rather than collected revenue, so one published number per service
stays true whether the referral pays retail, member, or veteran pricing. The discount
comes out of the clinic's margin, not the trainer's fee.

### Why the original flat buckets were replaced

The v1 tiers paid one flat amount per broad category, which produced wildly
inconsistent effective rates once spread across the real price range:

| v1 tier | Payout | Cheapest item in bucket | Priciest item |
|---|---|---|---|
| Biologics | $500 | **83%** (Nano PRP Jelly $600) | 10% (Nano Exosomes $5,000) |
| Mental Health | $100 | **25%** (Exomind $400) | 3.6% (Vagus Nerve $2,800) |
| Peptides | $75 | **59%** (Selank $127) | 10% (FOXO4-DRI $738) |
| Weight Loss | $75 | **75%** (WL Booster $100) | 9.4% (Retatrutide $799) |
| Shockwave | $50 | **36%** (single $140) | 4.2% (10-pack $1,190) |
| IV Therapy | $25 | 14.5% (IV Fluids $173) | 2.9% (COVID Rescue Plus $866) |
| NAD+ | $25 | **25%** (NAD+ 100mg $100) | 9.3% (NAD+ Vial $270) |

### Discount tiers differ per sheet (confirmed, not a transcription error)

- Mental Health, Wellness, Weight Loss, Aesthetics → **30% member / 50% veteran**
- Pain & Joint → **10% member / 20% veteran**, and its column header reads
  "Veteran Price", not "Veteran Member Price"

## Problem cues (page 2) and the explainer (page 3)

Each service carries a short cue describing **the complaint a member walks in with**,
never the outcome of treatment — "Depression, anxiety, PTSD", not "lifts depression".
Problem-framing is what a trainer actually needs to pattern-match on, and it keeps the
sheet clear of efficacy claims a non-clinician must not make.

The cue sits at category level (teal, above the table) since that is the level a trainer
decides at. Rows carry their own cue only where it differs from the category — the Nano
products deliberately do not, because choosing between them is the clinician's call, not
the trainer's.

Page 3 gives each category a plain-English card: what a member typically says, and what
the service actually is. Enough to make an introduction, not enough to advise.

> **Needs clinical review:** the cues and card copy were drafted from product names and
> general category knowledge. The Nano line in particular (`Nano Flow`, `Nano Flex`,
> `Nano DPM`, `Nano AER`/`AER+`, `Nano EX`) is proprietary and its indications were not
> verifiable from the pricelist — which is why those rows carry no individual cue. Have
> the clinical team confirm every cue before distribution.

## Open items

- [ ] **Confirm every problem cue and page-3 card** with the clinical team (see above).
- [ ] **Regenerative / stem cell regulatory statement** — page 3 ships with a visible
      dashed placeholder on page 2. Must be written from the clinic's actual documentation and
      cleared by the medical director + counsel. Do not distribute until replaced.
- [ ] **Botox** is priced per unit ($13); the $25 fee assumes a ~25-unit average
      treatment. Confirm the real average, or drop Botox to a per-unit rate.
- [ ] **Flat fee ignores package size** by design. A single ketamine session and a
      $6,000 six-session program both pay $100. Revisit if trainers should be pushed
      toward programs.
- [ ] **CPT 2102 Hormone Replacement Therapy** has no price in the master sheet. The
      schedule's "Hormone Therapy" tag is priced off the HRT Workup (2101, $250).
- [ ] Source typos left uncorrected in `master-pricelist.json`, fixed in the PDF:
      "Monitered" → Monitored (1006), "Dremal" → Dermal (6002/6003).
