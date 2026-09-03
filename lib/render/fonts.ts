import { readFile } from 'fs/promises'
import { join } from 'path'

// Vercel lambdas ship ZERO fonts — the clips pipeline learned this the hard
// way (libass rendered captions as nothing). Same trap here: without embedded
// faces Chromium silently falls back to Times New Roman and every slide comes
// out off-brand. So the faces are read off disk and inlined as data: URIs, and
// next.config.mjs traces ./assets/fonts/** into the render route.
//
// These are variable fonts — one file covers every weight, which keeps the
// inlined CSS about half the size of shipping four static cuts.

const FACES = [
  { family: 'Playfair Display', file: 'PlayfairDisplay[wght].ttf', style: 'normal' },
  { family: 'Playfair Display', file: 'PlayfairDisplay-Italic[wght].ttf', style: 'italic' },
  { family: 'Inter', file: 'Inter[opsz,wght].ttf', style: 'normal' },
  { family: 'Inter', file: 'Inter-Italic[opsz,wght].ttf', style: 'italic' },
] as const

let cached: string | null = null

/** `@font-face` block with every face inlined. Cached for the lambda's life. */
export async function fontFaceCss(): Promise<string> {
  if (cached) return cached
  const dir = join(process.cwd(), 'assets', 'fonts')
  const blocks = await Promise.all(
    FACES.map(async (face) => {
      const bytes = await readFile(join(dir, face.file))
      return `@font-face{font-family:'${face.family}';font-style:${face.style};font-weight:100 900;src:url(data:font/ttf;base64,${bytes.toString('base64')}) format('truetype');font-display:block}`
    })
  )
  cached = blocks.join('')
  return cached
}
