import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import type { RenderedPage } from './png'

const BUCKET = 'post-slides'

export interface StoredSlide {
  page: number
  url: string
  path: string
}

/**
 * Uploads a rendered carousel and returns permanent public URLs.
 *
 * Every render gets its own `version` segment, so re-rendering a post never
 * overwrites the previous set (the marketer may still have the old link open)
 * and no CDN cache can serve a stale page under a reused path.
 */
export async function storeSlides(
  slideSetId: string,
  pages: RenderedPage[]
): Promise<StoredSlide[]> {
  const supabase = createServerClient()
  const version = randomBytes(4).toString('hex')
  const stored: StoredSlide[] = []

  for (const page of pages) {
    const path = `${slideSetId}/${version}/${String(page.page).padStart(2, '0')}.png`
    const { error } = await supabase.storage.from(BUCKET).upload(path, page.png, {
      contentType: 'image/png',
      upsert: false,
    })
    if (error) throw error
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)
    stored.push({ page: page.page, url: publicUrl, path })
  }

  return stored
}
