import { listRotationPool, type PhotoRotationRow } from '@/lib/visual/photo-index-store'

// Clinic photo selection — doctrine v4 (Igor, 2026-08-17).
//
// The clinic's own Drive library carries ~40% of a carousel's photos.
// The question was how to order them: top-to-bottom burns the head of
// the list while the tail never ships; pure random collides far sooner
// than it feels like it should (61 photos, 3 picks a post → a repeat is
// likely inside a handful of posts). So: least-recently-used with a
// cooldown. A photo is only a candidate once it has rested, and among
// the rested ones the best tag match wins, oldest-first on a tie.
//
// Selection is a pure read. The cooldown clock only starts when the
// post actually composes — see markPhotosUsed.

const DEFAULT_COOLDOWN_DAYS = 30

export interface ClinicPhotoPick {
  n: number
  driveFileId: string
  fileName: string | null
  description: string
  restedDays: number | null // null = never used before
}

export interface ClinicPhotoSelection {
  picks: ClinicPhotoPick[]
  /** Non-fatal problems worth surfacing: empty library, cooldown relaxed. */
  warning: string | null
}

const STOP = new Set([
  'the', 'and', 'with', 'that', 'this', 'your', 'from', 'what', 'when', 'slide',
  'photo', 'image', 'clinic', 'patient', 'hawaii', 'shot',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

// Overlap between what the slide is about and what the photo shows.
// Tags are curated, so they count double against the free-text
// description the vision pass wrote.
function score(row: PhotoRotationRow, want: string[]): number {
  if (want.length === 0) return 0
  const tagWords = new Set(row.tags.flatMap((t) => tokens(t)))
  const descWords = new Set(tokens(row.description))
  let s = 0
  for (const w of want) {
    if (tagWords.has(w)) s += 2
    else if (descWords.has(w)) s += 1
  }
  return s
}

export async function pickClinicPhotos(params: {
  clinicId: string
  folderId: string
  slides: Array<{ n: number; subject: string; keywords?: string[] | null }>
  cooldownDays?: number
}): Promise<ClinicPhotoSelection> {
  const { clinicId, folderId, slides } = params
  const cooldown = params.cooldownDays ?? DEFAULT_COOLDOWN_DAYS
  if (slides.length === 0) return { picks: [], warning: null }

  // Already sorted longest-rested first by the store.
  const pool = await listRotationPool(clinicId, folderId)
  if (pool.length === 0) {
    return {
      picks: [],
      warning:
        'Clinic photo library is empty — nothing indexed for this folder. Slides fall back to AI.',
    }
  }

  const rested = pool.filter((p) => {
    const age = daysSince(p.last_used_at)
    return age === null || age >= cooldown
  })

  // Not enough rested photos: rather than skip slides, relax the
  // cooldown and say so out loud. A silent relax would read as "the
  // rotation is working" while the same faces come back every week.
  let candidates = rested
  let warning: string | null = null
  if (rested.length < slides.length) {
    candidates = pool
    warning =
      `Only ${rested.length} of ${pool.length} clinic photos have rested ${cooldown} days, ` +
      `but ${slides.length} are needed — cooldown relaxed for this post. Add more photos to the library.`
  }

  const taken = new Set<string>()
  const picks: ClinicPhotoPick[] = []

  for (const slide of slides) {
    const want = [...tokens(slide.subject), ...(slide.keywords ?? []).flatMap(tokens)]
    let best: PhotoRotationRow | null = null
    let bestScore = -1
    for (const row of candidates) {
      if (taken.has(row.drive_file_id)) continue
      const s = score(row, want)
      // Strictly greater: candidates arrive in LRU order, so an equal
      // score keeps the longest-rested photo.
      if (s > bestScore) {
        best = row
        bestScore = s
      }
    }
    if (!best) break // library smaller than the post — remaining slides fall back
    taken.add(best.drive_file_id)
    picks.push({
      n: slide.n,
      driveFileId: best.drive_file_id,
      fileName: best.file_name,
      description: best.description,
      restedDays: daysSince(best.last_used_at),
    })
  }

  if (picks.length < slides.length && !warning) {
    warning = `Clinic library has ${pool.length} photos, ${slides.length} needed for this post — the rest fall back to AI.`
  }

  return { picks, warning }
}
