// Render one Yedino post with the in-house Style 6 skin, so the result can
// be put next to its Canva twin.
//
// Deliberately standalone: lib/render/compose.ts reads the post out of
// Supabase, and this session has no database credentials. The slides are
// built from the same JSON the Canva batch was built from, so the two
// pictures are the same words — which is the only way the comparison means
// anything.
//
// Node 24 strips the types off the .ts imports on its own; no tsx needed.
//
//   node scripts/preview-style6.mjs [postNumber]

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSlideHtml } from '../lib/render/html.ts'
import { style6 } from '../lib/render/skins/style6.ts'
import { fontFaceCss } from '../lib/render/fonts.ts'

const R4 = '/Users/igorlinnik/Documents/Code Projects/Yedinosystems/R4'
const which = Number(process.argv[2] ?? 2)

const posts = JSON.parse(await readFile(join(R4, 'posts.json'), 'utf8'))
const post = posts.find((p) => p.n === which)
if (!post) throw new Error(`no post ${which} in posts.json`)

/** posts.json → RenderSlide[], the same six pages the master carries. */
const slides = [
  { page: 1, shape: 'cover', heading: post.cover },
  ...post.body.map((b, i) => ({
    page: i + 2,
    shape: 'prose',
    heading: b.title,
    body: b.text,
  })),
  { page: 6, shape: 'cta', heading: post.cta },
]

const fontCss = await fontFaceCss()
const outDir = join(R4, 'render', `post${which}`)
await mkdir(outDir, { recursive: true })

const puppeteer = (await import('puppeteer')).default
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 })
  for (const slide of slides) {
    const html = buildSlideHtml({
      slide,
      skin: style6,
      fontCss,
      handle: '@yedino.systems',
    })
    await page.setContent(html, { waitUntil: ['load'] })
    const fit = await page.evaluate('window.__fit')
    const png = await page.screenshot({ type: 'png' })
    const file = join(outDir, `${String(slide.page).padStart(2, '0')}.png`)
    await writeFile(file, png)
    console.log(
      `page ${slide.page}  scale=${fit?.scale ?? 1}${fit?.overflow ? '  OVERFLOW' : ''}  ${file}`
    )
  }
} finally {
  await browser.close()
}
