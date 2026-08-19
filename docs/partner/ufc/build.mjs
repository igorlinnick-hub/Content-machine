import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const fonts = readFileSync(new URL('./fonts.css', dir), 'utf8');
const logo = readFileSync(new URL('../../../public/brand/hwc-logo.png', dir)).toString('base64');

/* ── Commission schedule ────────────────────────────────────────────────
   One CRM tag = one service name = one flat fee. No dosages, no unit
   counts, no package variants — a course of treatment tags as the service
   and pays the service rate.

   Rate: ~10% of standard price, snapped to a clean tier
   ($25/50/75/100/150/200/250/300/500), $25 floor.
   Veterans already receive up to 50% off, so 10% is a fifth of the
   giveaway the clinic already absorbs — deliberately not the high end. */

const cats = [
  {
    name: 'Regenerative & Biologics',
    note: 'The highest-value referrals in the clinic.',
    rows: [
      ['Nano Exosomes', 500], ['Nano AER+', 300], ['Nano Flow', 300],
      ['Nano AER', 200], ['Nano Flex', 200], ['Nano Ex Hair Restoration', 150],
      ['Nano DPM', 100], ['Nano EX', 100], ['PRP', 100], ['Nano PRP Jelly', 50],
    ],
  },
  {
    name: 'Mental Health',
    rows: [
      ['Vagus Nerve Injection', 300], ['Stellate Ganglion Block', 200],
      ['Ketamine — Chronic Pain', 100], ['Ketamine — Mental Health', 75],
      ['Exomind', 50],
    ],
  },
  {
    name: 'Aesthetics & Hair',
    rows: [
      ['Hair Restoration', 250], ['Sculptra', 100],
      ['Dermal Fillers', 75], ['Botox', 25],
    ],
  },
  {
    name: 'Weight Loss',
    rows: [
      ['Retatrutide', 75], ['Semaglutide', 50], ['Tirzepatide', 50],
      ['Weight Loss Booster', 25],
    ],
  },
  {
    name: 'Pain & Joint',
    rows: [
      ['Shockwave Therapy', 25], ['Class IV Laser', 25], ['Vibration Therapy', 25],
    ],
  },
  {
    name: 'Peptide Therapy',
    note: 'Stack = a blend rather than a single peptide.',
    rows: [['Peptide Stack', 50], ['Peptide Therapy', 25]],
  },
  {
    name: 'IV Therapy & NAD+',
    note: 'Premium = Immunity Booster, COVID Rescue, Cold & Flu Plus, Beautify, Hangover Max.',
    rows: [['IV Therapy — Premium', 50], ['IV Therapy', 25], ['NAD+', 25]],
  },
  {
    name: 'Consultations & Hormone',
    rows: [['Consultation', 50], ['Hormone Therapy', 25]],
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
h1{font-family:var(--serif);font-size:31pt;font-weight:600;line-height:1.07;
  color:var(--ocean-dark);letter-spacing:-.012em;margin:18px 0 0}
h1 em{font-style:italic;color:var(--coral)}
.lede{font-size:10.6pt;color:var(--muted);max-width:5.7in;margin-top:12px;line-height:1.6}
.lede b{color:var(--ink);font-weight:600}

/* ── dark panel ── */
.panel{background:linear-gradient(145deg,#0d2f42 0%,#164863 100%);border-radius:15px;
  padding:22px 26px;color:#fff;margin-top:18px}
.panel .eyebrow{font-size:7.6pt;font-weight:700;letter-spacing:.19em;text-transform:uppercase;
  color:var(--teal);margin-bottom:9px}
.panel h2{font-family:var(--serif);font-size:21pt;font-weight:600;margin-bottom:11px;line-height:1.2}
.panel h2 em{font-style:italic;color:var(--coral)}
.panel p{font-size:9.8pt;line-height:1.68;color:rgba(255,255,255,.8);max-width:6in}
.panel p+p{margin-top:9px}
.panel b{color:#fff;font-weight:600}
.panel .hard{color:#f6b39c;font-weight:700}

/* ── access ── */
.access{margin-top:14px;display:flex;gap:12px;align-items:stretch}
.access .col{flex:1;background:var(--sand);border:1px solid rgba(27,79,110,.14);
  border-radius:11px;padding:15px 17px}
.access .col.wide{flex:1.7}
.access .lbl{font-size:7.2pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);margin-bottom:6px}
.access .val{font-family:ui-monospace,Menlo,monospace;font-size:10.5pt;font-weight:600;color:var(--ocean)}
.access .url{font-size:8.4pt;color:var(--ocean);font-weight:600;white-space:nowrap}

/* ── how paid ── */
.rate{margin-top:14px;background:var(--sand);border-radius:12px;padding:15px 20px;
  border:1px solid rgba(27,79,110,.13)}
.rate h3{font-family:var(--serif);font-size:14.5pt;font-weight:600;color:var(--ocean-dark);margin-bottom:8px}
.rate p{font-size:9.2pt;color:var(--muted);line-height:1.65}
.rate p+p{margin-top:7px}
.rate b{color:var(--ink);font-weight:600}

/* ── category tables ── */
.grid{column-count:2;column-gap:28px;margin-top:13px}
.cat{break-inside:avoid;margin-bottom:9px}
.cat-head{display:flex;align-items:center;gap:9px;margin-bottom:3px}
.cat h3{font-family:var(--serif);font-size:12pt;font-weight:600;color:var(--ocean-dark);white-space:nowrap}
.cat .rule{flex:1;height:1px;background:linear-gradient(90deg,rgba(58,174,160,.55),rgba(58,174,160,0))}
.cat-note{font-size:7.4pt;color:var(--muted);line-height:1.45;margin-bottom:4px;font-style:italic}
.cat table{width:100%;border-collapse:collapse;margin-top:3px}
.cat tr{border-bottom:1px solid rgba(27,79,110,.09)}
.cat tr:last-child{border-bottom:none}
.cat td{padding:3.6px 0;font-size:9.1pt;vertical-align:baseline}
.cat td.pay{text-align:right;font-weight:700;color:var(--coral);
  font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:10px}

/* ── fine print ── */
.fine{margin-top:14px;padding-top:12px;border-top:1px solid rgba(27,79,110,.12)}
.fine h3{font-family:var(--serif);font-size:12.6pt;font-weight:600;color:var(--ocean-dark);margin-bottom:9px}
.fine ul{list-style:none;columns:2;column-gap:28px}
.fine li{font-size:8.3pt;color:var(--muted);line-height:1.5;margin-bottom:4px;
  padding-left:13px;position:relative;break-inside:avoid}
.fine li::before{content:'';position:absolute;left:0;top:6.5px;width:4px;height:4px;
  border-radius:50%;background:var(--teal)}
.fine b{color:var(--ink);font-weight:600}

/* ── compliance ── */
.legal{margin-top:8px;background:#fff;border:1px solid rgba(27,79,110,.16);
  border-radius:10px;padding:11px 14px}
.legal h4{font-size:8pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;
  color:var(--ocean);margin-bottom:7px}
.legal p{font-size:7.4pt;line-height:1.56;color:var(--muted)}
.legal p+p{margin-top:5px}
.legal b{color:var(--ink);font-weight:600}
.todo{background:#fff8e6;border:1.5px dashed #d99b2f;border-radius:8px;
  padding:9px 12px;margin-top:8px}
.todo p{font-size:7.3pt;line-height:1.52;color:#7a5410}
.todo b{color:#7a5410;font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:7.3pt}

/* ── footer ── */
.foot{margin-top:auto;padding-top:14px;display:flex;justify-content:space-between;
  font-size:7pt;color:#94a3ab;letter-spacing:.03em;border-top:1px solid rgba(27,79,110,.1)}
</style>

${page('Page 1 of 2', `
<div class="mast">
  <img src="data:image/png;base64,${logo}" alt="Hawaii Wellness Clinic">
  <div class="who"><b>Partner Guide</b>UFC GYM Trainers &amp; Management<br>Repeat Cash Program &nbsp;·&nbsp; 2026</div>
</div>

<h1>Every service.<br>Every payout. <em>One page.</em></h1>
<p class="lede">The complete Repeat Cash schedule — every service Hawaii Wellness Clinic pays you
to refer, and exactly what each one is worth. <b>One service, one flat fee.</b> Credited
automatically the moment your referral gets care.</p>

<div class="panel">
  <div class="eyebrow">Before anything else</div>
  <h2>Use your first <em>and</em> last name.</h2>
  <p>When your referral fills out the form, they enter <b>your first and last name</b> — that
  single field is what ties the sale to you. A first name on its own is not enough: we have
  trainers who share one, and an entry we can't match to a person is an entry
  <span class="hard">we can't pay</span>.</p>
  <p>Spell it the same way every time, and it lands in your balance on its own.</p>
</div>

<div class="access">
  <div class="col wide"><div class="lbl">Check your balance</div><div class="url">dashboard-hwc.vercel.app/login/ufc</div></div>
  <div class="col"><div class="lbl">Trainers</div><div class="val">ufc-team-2026</div></div>
  <div class="col"><div class="lbl">Management</div><div class="val">ufc-gym-2026</div></div>
</div>

<div class="rate">
  <h3>How the numbers are set</h3>
  <p>Each fee is roughly <b>10% of the clinic's standard price</b> for that service, rounded to a
  clean figure. For scale: HWC already takes <b>up to 50% off for veterans</b> — so a referral fee
  at 10% sits comfortably inside what the clinic absorbs every day. It's a fraction of that, by design.</p>
  <p>Your fee is <b>the same no matter who you refer.</b> Members and veterans pay less; that
  discount comes out of the clinic's side, never out of yours.</p>
</div>
<div class="fine">
  <h3>Good to know</h3>
  <ul>
    <li><b>Both names, every time.</b> First and last on the referral form, spelled consistently.</li>
    <li><b>Credited on completion</b>, not on booking. A no-show credits nothing.</li>
    <li><b>Consultations pay too.</b> $50 on the first visit, then again when they start treatment.</li>
    <li><b>One fee per service</b>, whatever the dose or package size.</li>
    <li><b>Repeat Cash is clinic credit</b>, redeemable at HWC. Not cash, not transferable.</li>
    <li><b>Fees can change.</b> Your portal balance is always the current figure.</li>
  </ul>
</div>
`)}

${page('Page 2 of 2', `
<div class="mast">
  <img src="data:image/png;base64,${logo}" alt="Hawaii Wellness Clinic">
  <div class="who"><b>Commission Schedule</b>What you earn per referral<br>Effective 2026</div>
</div>
<h1 style="font-size:21pt;margin-top:10px">What you <em>earn</em></h1>
<p class="lede" style="font-size:9.4pt;margin-top:6px;max-width:6.2in">One name, one fee — the same tag we use in the clinic's system. Dose and package size don't change it.</p>

<div class="grid">${cats.map(table).join('')}</div>

<div class="legal">
  <h4>Please read — what trainers can and cannot say</h4>
  <p>Hawaii Wellness Clinic is a physician-supervised medical clinic. Your role is to <b>introduce
  people to the clinic</b> — not to diagnose, prescribe, recommend a specific treatment, or give
  medical advice. Whether a service suits someone is decided only by an HWC clinician after
  evaluation. Please don't promise an outcome, quote a success rate, or tell a member which therapy
  they need.</p>
  <p>Many therapies offered at HWC — including ketamine for mental health, peptide therapy, and
  compounded weight-loss medications — are prescribed <b>off-label or are not FDA-approved</b> for
  those uses. That is lawful medical practice, but it is not the same as an approved product and
  should never be described as one.</p>
  <div class="todo"><p><b>Placeholder — do not distribute until replaced</b><br>
  The clinic's regenerative / stem cell regulatory statement goes here. It must be written from the
  documentation the clinic actually holds and cleared by the medical director and counsel first.</p></div>
</div>
`)}
`;

writeFileSync(new URL('./commission-schedule.html', dir), html);
console.log(`built ${(html.length / 1024 / 1024).toFixed(2)} MB · ${cats.reduce((n, c) => n + c.rows.length, 0)} services`);
