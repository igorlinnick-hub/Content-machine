# UFC GYM Partner — Repeat Cash Commission Schedule

HWC-branded 3-page PDF listing every service a UFC GYM trainer can refer and what
each one pays. Extends the original 8-bucket "What you can earn" panel in the
UFC Trainer Partner Guide into the full catalog.

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

Payout rule, applied uniformly:

- **10% of retail (list) price**, rounded to the nearest $5
- **$25 floor** on any completed treatment
- **No ceiling**
- Consultation held at **$50** — unchanged from v1, it's the acquisition hook

Retail is the basis, so a trainer earns the same regardless of whether the referral
pays retail, member, or veteran pricing. The discount comes out of the clinic's margin.

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

Two v1 numbers land on exactly 10% of retail — Myer's Cocktail ($246 → $25) and
Nano Exosomes ($5,000 → $500) — which is why 10% was adopted as the uniform basis.

### Discount tiers differ per sheet (confirmed, not a transcription error)

- Mental Health, Wellness, Weight Loss, Aesthetics → **30% member / 50% veteran**
- Pain & Joint → **10% member / 20% veteran**, and its column header reads
  "Veteran Price", not "Veteran Member Price"

This is why payouts are computed on retail rather than collected revenue — a single
published number per service stays true across all three customer types.

## Open items

- [ ] **Regenerative / stem cell regulatory statement** — page 3 ships with a visible
      dashed placeholder. Must be written from the clinic's actual documentation and
      cleared by the medical director + counsel. Do not distribute until replaced.
- [ ] **Botox** is priced per unit ($13). The $30 payout assumes a ~25-unit average
      treatment (~$325). Confirm the real average or move Botox to a per-unit rate.
- [ ] **CPT 2102 Hormone Replacement Therapy** has no price in the master sheet, so it
      is absent from the schedule. HRT Workup (2101) is included.
- [ ] Source typos left uncorrected in `master-pricelist.json`, fixed in the PDF:
      "Monitered" → Monitored (1006), "Dremal" → Dermal (6002/6003).
