# Visual module setup

The visual module turns a shipped script into 5–7 Instagram slide PNGs. It is deliberately isolated — it only reads `scripts` and `slide_sets` from the database and never imports from the writer, critic, or other agents.

## Local development

`puppeteer` is in `dependencies`. `npm install` downloads its bundled Chromium. No further setup needed — the first render triggers the browser download.

```bash
curl -s -X POST http://localhost:3000/api/visual/generate \
  -H 'content-type: application/json' \
  -d '{"scriptId":"<uuid>"}' | jq '.slide_count'
```

`/visual` in the browser exposes the full UI: pick a script, pick a Drive photo folder, render, preview, download ZIP, edit the style template.

## Vercel deployment — puppeteer caveat

Vercel serverless functions have a 50 MB unzipped deploy size and no bundled Chromium. The stock `puppeteer` package is too heavy.

When you're ready to deploy:

1. Add the chromium-in-a-layer package:
   ```bash
   npm i @sparticuz/chromium puppeteer-core
   npm uninstall puppeteer
   ```
2. Edit `lib/visual/renderer.ts` → replace `launchBrowser()` with the chromium-core variant:
   ```ts
   async function launchBrowser() {
     const chromium = (await import('@sparticuz/chromium')).default
     const puppeteer = await import('puppeteer-core')
     return puppeteer.launch({
       args: chromium.args,
       executablePath: await chromium.executablePath(),
       headless: true,
     })
   }
   ```
3. Keep everything else — `renderSlide`, `renderSlides`, `buildSlideHTML` are unchanged.

No other module touches Puppeteer, so the swap is local to `renderer.ts`.

## Style template

The first time a clinic renders slides, the module uses `DEFAULT_VISUAL_STYLE` (1080×1080, white background, Inter 64px). Save a custom template once from `/visual` → *Edit style template (JSON)*. Subsequent renders pick up the latest saved `slide_sets.style_template` for the clinic.

## Drive photos

Drive integration is the same service account as script export (see `docs/google-drive-setup.md`). The photo folder id is passed per-request to `/api/visual/generate` — only used when `style_template.background.type === 'photo'`. Photos cycle across slides in Drive listing order.
