import type { StructuredPlanWeek } from './store'
import { pillarColor } from './store'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface PlanPdfInput {
  clinicName: string
  plan: StructuredPlanWeek[]
  currentWeekId: string | null
  generatedOn: string // human date, e.g. 'July 20, 2026'
}

// Print-oriented HTML for the whole editorial plan. Rendered by Chromium
// into an A4 PDF — keep everything self-contained (no external assets,
// no emoji: @sparticuz/chromium only ships a latin font set).
export function buildPlanPdfHtml({ clinicName, plan, currentWeekId, generatedOn }: PlanPdfInput): string {
  const totalPosts = plan.reduce((s, w) => s + w.posts.length, 0)

  const pillarCounts = new Map<string, number>()
  for (const week of plan) {
    pillarCounts.set(week.pillar, (pillarCounts.get(week.pillar) ?? 0) + week.posts.length)
  }
  const pillars = Array.from(pillarCounts.entries()).sort((a, b) => b[1] - a[1])

  const pillarChips = pillars
    .map(([pillar, count]) => {
      const color = pillarColor(pillar)
      return `<div class="pillar" style="border-color:${color}40;background:${color}0d">
        <span class="pillar-dot" style="background:${color}"></span>
        <span class="pillar-name" style="color:${color}">${esc(pillar)}</span>
        <span class="pillar-count">${count} post${count !== 1 ? 's' : ''}</span>
      </div>`
    })
    .join('')

  const weekCards = plan
    .map((week) => {
      const color = pillarColor(week.pillar)
      const isCurrent = week.id === currentWeekId
      const posts = week.posts
        .map((post, i) => {
          const skipped = post.status === 'skipped'
          const done = post.status === 'done'
          return `<div class="post" style="background:${color}08;border-color:${color}1f">
            <span class="post-num" style="color:${color}">${String(i + 1).padStart(2, '0')}</span>
            <span class="post-topic${skipped ? ' post-skipped' : ''}">${esc(post.topic)}${done ? ' <span class="post-done" style="color:' + color + '">&#10003;</span>' : ''}</span>
            ${post.keyword ? `<span class="post-keyword" style="background:${color}18;color:${color}">${esc(post.keyword)}</span>` : ''}
          </div>`
        })
        .join('')

      return `<section class="week" style="border-color:${isCurrent ? color : '#e7e5e4'}">
        <div class="week-head">
          <span class="week-label">Week ${week.week_number}</span>
          ${isCurrent ? `<span class="week-now" style="background:${color}20;color:${color}">Now</span>` : ''}
          <span class="week-pillar" style="background:${color}18;color:${color};border-color:${color}30">${esc(week.pillar)}</span>
        </div>
        <h2 class="week-theme">${esc(week.theme)}</h2>
        ${week.description ? `<p class="week-desc">${esc(week.description)}</p>` : ''}
        <div class="posts">${posts}</div>
      </section>`
    })
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Open Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1c1917;
    font-size: 10px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-head { margin-bottom: 16px; }
  .eyebrow {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #a8a29e;
    margin-bottom: 6px;
  }
  h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
  .meta { font-size: 10px; color: #78716c; }
  .pillars { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 18px; }
  .pillar {
    display: flex; align-items: center; gap: 6px;
    border: 1px solid; border-radius: 999px;
    padding: 4px 10px;
  }
  .pillar-dot { width: 6px; height: 6px; border-radius: 999px; }
  .pillar-name { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .pillar-count { font-size: 8px; color: #78716c; }
  .weeks { columns: 2; column-gap: 10px; }
  .week {
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
    page-break-inside: avoid;
    border: 1.5px solid;
    border-radius: 10px;
    padding: 10px 11px;
    margin-bottom: 10px;
    background: #fff;
  }
  .week-head { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
  .week-label {
    font-size: 7.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.16em; color: #a8a29e;
  }
  .week-now, .week-pillar {
    font-size: 7px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; border-radius: 999px; padding: 2px 6px;
  }
  .week-pillar { border: 1px solid; }
  .week-theme { font-size: 12px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.3; margin-bottom: 4px; }
  .week-desc { font-size: 8.5px; line-height: 1.5; color: #57534e; margin-bottom: 7px; }
  .posts { display: flex; flex-direction: column; gap: 4px; }
  .post {
    display: flex; align-items: baseline; gap: 6px;
    border: 1px solid; border-radius: 7px;
    padding: 4px 7px;
  }
  .post-num { font-size: 8px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .post-topic { flex: 1; font-size: 9px; line-height: 1.35; color: #44403c; }
  .post-skipped { text-decoration: line-through; color: #a8a29e; }
  .post-done { font-weight: 700; }
  .post-keyword {
    font-size: 7px; font-weight: 700; font-family: ui-monospace, Menlo, Consolas, monospace;
    border-radius: 4px; padding: 1.5px 5px; white-space: nowrap;
  }
</style>
</head>
<body>
  <header class="doc-head">
    <div class="eyebrow">Content Machine &middot; Editorial Plan</div>
    <h1>${esc(clinicName)}</h1>
    <div class="meta">${plan.length}-week cycle &middot; ${totalPosts} posts &middot; ${pillars.length} pillar${pillars.length !== 1 ? 's' : ''} &middot; Generated ${esc(generatedOn)}</div>
  </header>
  <div class="pillars">${pillarChips}</div>
  <div class="weeks">${weekCards}</div>
</body>
</html>`
}

// Render HTML → A4 PDF. Serverless (Vercel/Lambda) uses puppeteer-core +
// @sparticuz/chromium; local dev falls back to the devDep puppeteer with
// its bundled Chrome. Same split as scripts/smoke-render.mjs — all three
// packages are marked external in next.config.mjs so the dynamic imports
// resolve from node_modules at runtime.
export async function renderPlanPdf(html: string, footerLeft: string): Promise<Buffer> {
  const serverless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any
  if (serverless) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer = (await import('puppeteer' as any)).default
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    })
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'a4',
      printBackground: true,
      margin: { top: '12mm', bottom: '16mm', left: '11mm', right: '11mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 11mm;display:flex;justify-content:space-between;font-size:7px;color:#a8a29e;font-family:Helvetica,Arial,sans-serif;">
        <span>${esc(footerLeft)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
