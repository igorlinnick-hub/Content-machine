import type { TypedSlide, VisualStyle } from '@/types'
import { getPhotosFromFolder, getPhotoDataUrl } from '@/lib/google/drive'
import { getPhotoOverrides } from './photo-index-store'
import { resolveEffectiveFolderId } from './folder'

// Look up the Drive folder linked to a slide_set's category and resolve
// photo URLs (as base64 data URLs the headless browser can render) per
// slide. Cover slides always get null — they render on white with the
// sky gradient, no photo. Body and CTA slides cycle through available
// photos, UNLESS slide_sets.photo_overrides has an entry for that slide
// index (set by the team via the PhotoPicker UI), in which case the
// override wins.
//
// Used by every render path EXCEPT generate-time (which already has the
// photos and category in scope).
export async function loadPhotoUrlsForSlideSet(
  slideSetId: string,
  slides: TypedSlide[],
  style: VisualStyle
): Promise<(string | null)[]> {
  if (slides.length === 0) return []
  if (style.background.type !== 'photo') return slides.map(() => null)

  const folderId = await resolveEffectiveFolderId(slideSetId)
  if (!folderId) return slides.map(() => null)

  const overrides = await getPhotoOverrides(slideSetId)

  try {
    const photos = await getPhotosFromFolder(folderId)
    if (photos.length === 0 && Object.keys(overrides).length === 0) {
      return slides.map(() => null)
    }
    // Per-slide resolution: override beats auto-cycle. Cover stays null.
    const ids = slides.map((s, i) => {
      if (s.kind === 'cover') return null
      const ov = overrides[String(i)]
      if (ov) return ov
      return photos.length > 0 ? photos[i % photos.length]?.id ?? null : null
    })
    return await Promise.all(
      ids.map((id) => (id ? getPhotoDataUrl(id) : Promise.resolve(null)))
    )
  } catch {
    return slides.map(() => null)
  }
}
