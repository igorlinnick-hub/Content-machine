import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const fonts = readFileSync(new URL('./fonts.css', dir), 'utf8');
const logo = readFileSync(new URL('../../../public/brand/hwc-logo.png', dir)).toString('base64');

/* ── Commission schedule ────────────────────────────────────────────────
   Basis: 10% of RETAIL (list) price, rounded to nearest $5.
   Floor: $25 per completed treatment.  No ceiling.
   Consultation held at $50 as the acquisition hook (unchanged from v1). */

const cats = [
  {
    name: 'Regenerative & Biologics',
    note: 'Highest-value referrals in the clinic.',
    rows: [
      ['Nano Exosomes 180bil/ml', 500], ['PRP — 6 Treatments', 335],
      ['Nano AER+ (90bil)', 300], ['Nano Flow (1ml/150mg)', 285],
      ['PRP — 3 Treatments', 240], ['Nano Flex (1ml/150mg)', 225],
      ['Nano AER (50bil)', 200], ['Nano Ex Hair Restoration', 135],
      ['Nano DPM (95mg)', 120], ['Nano EX (30bil)', 100],
      ['PRP — Single Treatment', 90], ['Nano PRP Jelly', 60],
    ],
  },
  {
    name: 'Mental Health',
    note: 'Programs pay on the full course, credited at first session.',
    rows: [
      ['SGB (2) + Ketamine (6) Program', 600],
      ['Ketamine Mental Health Program — 6 Sessions', 360],
      ['Stellate Ganglion Block Program — 2 Sessions', 360],
      ['Ketamine Chronic Pain Program — 4 Sessions', 320],
      ['Exomind Program — 6 Sessions', 300],
      ['Vagus Nerve Injection', 280], ['Stellate Ganglion Block', 220],
      ['Ketamine Session — Chronic Pain', 100],
      ['Ketamine Session — Mental Health', 80], ['Exomind — Single Session', 40],
    ],
  },
  {
    name: 'Aesthetics & Hair Restoration',
    rows: [
      ['Hair Restoration — 4 Treatment Package', 795],
      ['Hair Restoration — Single Treatment', 265],
      ['Sculptra', 100], ['Dermal Fillers — Lips', 70],
      ['Dermal Fillers — Chin', 70], ['Botox — per treatment', 30],
    ],
  },
  {
    name: 'Weight Loss',
    rows: [
      ['Retatrutide — 4 Injections', 80], ['Tirzepatide — 4 Injections', 60],
      ['Semaglutide — 4 Injections', 40], ['Weight Loss Booster', 25],
    ],
  },
  {
    name: 'Pain & Joint',
    note: 'Shockwave, Class IV Laser and Vibration all pay the same.',
    rows: [
      ['Any modality — 10 Treatment Package', 120],
      ['Any modality — 6 Treatment Package', 75],
      ['Shockwave Therapy — Single', 25],
      ['Class IV Laser — Single', 25],
      ['Vibration Therapy — Single', 25],
    ],
  },
  {
    name: 'Peptide Therapy',
    note: 'Premium = stacks and blends (Wolverine, Brain Blend, GLOW, KLOW, Tesofensine, FOXO4-DRI).',
    rows: [['Premium stacks & blends', 60], ['Standard single peptides', 25]],
  },
  {
    name: 'IV Therapy & NAD+',
    note: 'Premium = Immunity Booster, COVID Rescue, Cold & Flu Plus, Beautify, Hangover Max.',
    rows: [['Premium IV Drip', 50], ['Standard IV Drip', 25], ['NAD+ — 100mg or Vial', 25]],
  },
  {
    name: 'Consultations & Hormone',
    note: 'Paid on the first completed visit, then again when they start treatment.',
    rows: [['Any Consultation — first visit', 50], ['HRT Workup', 25]],
  },
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const table = c => `
<section class="cat">
  <div class="cat-head"><h3>${esc(c.name)}</h3><span class="rule"></span></div>
  ${c.note ? `<p class="cat-note">${esc(c.note)}</p>` : ''}
  <table>${c.rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="pay">$${v}</td></tr>`).join('')}</table>
</section>`;

const page = (n, body) => `<div class="page">${body}<div class="foot">
  <span>Hawaii Wellness Clinic &nbsp;·&nbsp; UFC GYM Partner Program</span>
  <span>Repeat Cash Commission Schedule &nbsp;·&nbsp; ${n}</span></div></div>`;

const html = `<meta charset="utf-8"><title>Repeat Cash Commission Schedule</title><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ocean:#1b4f6e; --ocean-dark:#0d2f42; --teal:#3aaea0; --teal-light:#a8d8d3;
  --coral:#e07a5f; --sand:#f5ede0; --cream:#faf7f1; --ink:#16303f; --muted:#5f7280;
  --serif:'Playfair Display',Georgia,serif; --sans:'Inter',system-ui,sans-serif;
}
@page{size:letter;margin:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:var(--sans);color:var(--ink);background:var(--cream);font-size:10.5pt;line-height:1.5}
.page{width:8.5in;height:11in;padding:.62in .68in .5in;background:var(--cream);
  position:relative;display:flex;flex-direction:column;page-break-after:always;overflow:hidden}
.page:last-child{page-break-after:auto}

/* ── masthead ── */
.mast{display:flex;justify-content:space-between;align-items:flex-start;
  padding-bottom:14px;border-bottom:1.5px solid rgba(27,79,110,.16)}
.mast img{width:158px;height:auto}
.mast .who{text-align:right;font-size:7.6pt;line-height:1.65;color:var(--muted);padding-top:3px}
.mast .who b{display:block;color:var(--teal);font-weight:700;letter-spacing:.17em;
  text-transform:uppercase;font-size:7.4pt;margin-bottom:2px}

/* ── hero ── */
h1{font-family:var(--serif);font-size:29pt;font-weight:600;line-height:1.07;
  color:var(--ocean-dark);letter-spacing:-.012em;margin:18px 0 0}
h1 em{font-style:italic;color:var(--coral)}
.lede{font-size:10.2pt;color:var(--muted);max-width:5.6in;margin-top:9px;line-height:1.58}
.lede b{color:var(--ink);font-weight:600}

/* ── dark panel ── */
.panel{background:linear-gradient(145deg,#0d2f42 0%,#164863 100%);border-radius:15px;
  padding:21px 24px;color:#fff;margin-top:16px}
.panel h2{font-family:var(--serif);font-size:16.5pt;font-weight:600;margin-bottom:4px}
.panel h2 em{font-style:italic;color:var(--teal-light)}
.panel .sub{font-size:8.6pt;color:rgba(255,255,255,.62);margin-bottom:14px}

/* ── steps ── */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.step{background:rgba(255,255,255,.055);border:1px solid rgba(168,216,211,.2);
  border-radius:11px;padding:13px 14px}
.step .n{font-family:var(--serif);font-size:9.5pt;color:var(--teal);font-weight:700;
  letter-spacing:.15em;text-transform:uppercase;margin-bottom:5px}
.step h4{font-family:var(--serif);font-size:13pt;font-weight:600;margin-bottom:6px;color:#fff}
.step p{font-size:8.5pt;line-height:1.58;color:rgba(255,255,255,.76)}
.step b{color:#fff;font-weight:600}

/* ── callout ── */
.callout{margin-top:12px;background:rgba(224,122,95,.13);border:1px solid rgba(224,122,95,.42);
  border-left:3.5px solid var(--coral);border-radius:9px;padding:11px 14px;display:flex;gap:11px}
.callout .ic{font-size:14pt;line-height:1}
.callout h5{font-size:9.2pt;font-weight:700;color:#fbd9cd;margin-bottom:3px;
  letter-spacing:.04em;text-transform:uppercase}
.callout p{font-size:8.7pt;line-height:1.6;color:rgba(255,255,255,.86)}
.callout b{color:#fff;font-weight:700}

/* ── access ── */
.access{margin-top:15px;display:flex;gap:12px;align-items:stretch}
.access .col{flex:1;background:var(--sand);border:1px solid rgba(27,79,110,.14);
  border-radius:11px;padding:15px 17px}
.access .lbl{font-size:7.2pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);margin-bottom:6px}
.access .val{font-family:ui-monospace,Menlo,monospace;font-size:10.5pt;font-weight:600;color:var(--ocean)}
.access .url{font-size:8.4pt;color:var(--ocean);font-weight:600;white-space:nowrap}
.access .col.wide{flex:1.7}

/* ── how paid ── */
.rate{margin-top:15px;background:var(--sand);border-radius:12px;padding:16px 20px;
  border:1px solid rgba(27,79,110,.13)}
.rate h3{font-family:var(--serif);font-size:14pt;font-weight:600;color:var(--ocean-dark);margin-bottom:7px}
.rate p{font-size:9pt;color:var(--muted);line-height:1.62}
.rate p+p{margin-top:6px}
.rate b{color:var(--ink);font-weight:600}

/* ── category tables ── */
.grid{column-count:2;column-gap:26px;margin-top:20px}
.cat{break-inside:avoid;margin-bottom:19px}
.cat-head{display:flex;align-items:center;gap:9px;margin-bottom:3px}
.cat h3{font-family:var(--serif);font-size:12.4pt;font-weight:600;color:var(--ocean-dark);white-space:nowrap}
.cat .rule{flex:1;height:1px;background:linear-gradient(90deg,rgba(58,174,160,.55),rgba(58,174,160,0))}
.cat-note{font-size:7.6pt;color:var(--muted);line-height:1.5;margin-bottom:6px;font-style:italic}
.cat table{width:100%;border-collapse:collapse;margin-top:4px}
.cat tr{border-bottom:1px solid rgba(27,79,110,.09)}
.cat tr:last-child{border-bottom:none}
.cat td{padding:4.6px 0;font-size:8.9pt;vertical-align:baseline}
.cat td.pay{text-align:right;font-weight:700;color:var(--coral);
  font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:10px}

/* ── fine print ── */
.fine{margin-top:auto;padding-top:18px}
.fine h3{font-family:var(--serif);font-size:12.4pt;font-weight:600;color:var(--ocean-dark);margin-bottom:8px}
.fine ul{list-style:none;columns:2;column-gap:26px}
.fine li{font-size:8.2pt;color:var(--muted);line-height:1.55;margin-bottom:6px;
  padding-left:13px;position:relative;break-inside:avoid}
.fine li::before{content:'';position:absolute;left:0;top:6.5px;width:4px;height:4px;
  border-radius:50%;background:var(--teal)}
.fine b{color:var(--ink);font-weight:600}

/* ── compliance ── */
.legal{margin-top:16px;background:#fff;border:1px solid rgba(27,79,110,.16);
  border-radius:10px;padding:16px 18px}
.legal h4{font-size:8pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;
  color:var(--ocean);margin-bottom:8px}
.legal p{font-size:7.8pt;line-height:1.62;color:var(--muted)}
.legal p+p{margin-top:6px}
.legal b{color:var(--ink);font-weight:600}
.todo{background:#fff8e6;border:1.5px dashed #d99b2f;border-radius:8px;
  padding:11px 14px;margin-top:10px}
.todo p{font-size:7.8pt;line-height:1.6;color:#7a5410}
.todo b{color:#7a5410;font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:7.4pt}

/* ── footer ── */
.foot{margin-top:auto;padding-top:14px;display:flex;justify-content:space-between;
  font-size:7pt;color:#94a3ab;letter-spacing:.03em;border-top:1px solid rgba(27,79,110,.1)}
</style>

${page('Page 1 of 3', `
<div class="mast">
  <img src="data:image/png;base64,${logo}" alt="Hawaii Wellness Clinic">
  <div class="who"><b>Partner Guide</b>UFC GYM Trainers &amp; Management<br>Repeat Cash Program &nbsp;·&nbsp; 2026</div>
</div>

<h1>Every service.<br>Every payout. <em>One page.</em></h1>
<p class="lede">This is the complete Repeat Cash schedule — the full list of what Hawaii Wellness Clinic
pays you for each referral that comes in and gets care. <b>You earn on every service below</b>, not just
the popular ones. Credited automatically. No forms, no invoicing, no chasing anyone.</p>

<div class="panel">
  <h2>How it <em>works</em></h2>
  <div class="sub">Three steps — the only one you have to get right is the first.</div>
  <div class="steps">
    <div class="step"><div class="n">01 — Refer</div><h4>Send them in</h4>
      <p>Point the member to the gym's QR code. When they apply, they enter
      <b>your first and last name</b> — that's what ties the referral to you.</p></div>
    <div class="step"><div class="n">02 — Earn</div><h4>They get care</h4>
      <p>Repeat Cash lands in your balance the moment your referral completes a
      consultation or treatment. Amount depends on the service.</p></div>
    <div class="step"><div class="n">03 — Redeem</div><h4>Spend it here</h4>
      <p>Tell the HWC front desk on your next visit. Your balance applies to
      <b>any service</b> in this guide. Updates right away.</p></div>
  </div>

  <div class="callout"><div class="ic">&#9888;</div><div>
    <h5>First AND last name — every time</h5>
    <p>The referral form needs <b>both your first and last name</b>. First name alone is not enough —
    we have multiple trainers sharing a first name, and an incomplete entry can't be matched to you.
    If it can't be matched, <b>the credit can't be paid</b>. Spell it the same way every time.</p>
  </div></div>
</div>

<div class="access">
  <div class="col wide"><div class="lbl">Check your balance</div><div class="url">dashboard-hwc.vercel.app/login/ufc</div></div>
  <div class="col"><div class="lbl">Trainers</div><div class="val">ufc-team-2026</div></div>
  <div class="col"><div class="lbl">Management</div><div class="val">ufc-gym-2026</div></div>
</div>

<div class="rate">
  <h3>How the numbers are set</h3>
  <p>Every payout on the next two pages is <b>10% of the clinic's standard list price</b> for that
  service, rounded to the nearest $5, with a <b>$25 minimum</b> on any completed treatment.</p>
  <p>Your payout is <b>the same no matter who you refer</b> — members and veterans receive discounted
  care, and that discount comes out of the clinic's side, never yours.</p>
</div>
`)}

${page('Page 2 of 3', `
<div class="mast">
  <img src="data:image/png;base64,${logo}" alt="Hawaii Wellness Clinic">
  <div class="who"><b>Commission Schedule</b>What you earn per referral<br>Effective 2026</div>
</div>
<h1 style="font-size:25pt;margin-top:20px">What you <em>earn</em></h1>
<p class="lede" style="font-size:10pt;margin-top:8px">Sorted highest to lowest inside each category.
Programs and packages pay on the full course and are credited at the first session.</p>
<div class="grid">${cats.slice(0, 4).map(table).join('')}</div>
`)}

${page('Page 3 of 3', `
<div class="mast">
  <img src="data:image/png;base64,${logo}" alt="Hawaii Wellness Clinic">
  <div class="who"><b>Commission Schedule</b>continued<br>Effective 2026</div>
</div>
<div class="grid" style="margin-top:24px">${cats.slice(4).map(table).join('')}</div>

<div class="fine">
  <h3>Good to know</h3>
  <ul>
    <li><b>Both names, every time.</b> First and last name on the referral form, spelled consistently.</li>
    <li><b>Credited on completion</b>, not on booking. If your referral no-shows, nothing is credited.</li>
    <li><b>Consultations pay too.</b> You earn $50 on the first visit, then again when they start treatment.</li>
    <li><b>Packages pay once</b>, on the full course, at the first session — not per session.</li>
    <li><b>Repeat Cash is clinic credit</b>, redeemable at HWC. It is not cash and is not transferable.</li>
    <li><b>Prices and payouts can change.</b> The live balance in your portal is always the current figure.</li>
  </ul>
</div>

<div class="legal">
  <h4>Please read — what trainers can and cannot say</h4>
  <p>Hawaii Wellness Clinic is a physician-supervised medical clinic. Your role is to <b>introduce
  people to the clinic</b> — not to diagnose, prescribe, recommend a specific treatment, or give medical
  advice of any kind. Whether a service is appropriate for someone is decided only by an HWC clinician
  after evaluation. Please don't promise an outcome, quote a success rate, or tell a member which
  therapy they need.</p>
  <p>Many therapies offered at HWC — including ketamine for mental health, peptide therapy, and
  compounded weight-loss medications — are prescribed <b>off-label or are not FDA-approved</b> for
  those uses. That is lawful medical practice, but it is not the same as an approved product, and it
  should never be described as one.</p>
  <div class="todo"><p><b>Placeholder — do not distribute until replaced</b><br>
  The clinic's regenerative / stem cell regulatory statement goes here. This must be written from the
  actual documentation the clinic holds and cleared by the medical director and counsel before this
  guide is handed to anyone. See the accompanying note.</p></div>
</div>
`)}
`;

writeFileSync(new URL('./commission-schedule.html', dir), html);
console.log(`built ${(html.length / 1024 / 1024).toFixed(2)} MB · ${cats.reduce((n, c) => n + c.rows.length, 0)} line items`);
