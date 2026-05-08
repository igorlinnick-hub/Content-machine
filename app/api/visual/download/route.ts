import { NextResponse } from 'next/server'
import archiver from 'archiver'
import { loadSlideSet, markSlideSetStatus } from '@/lib/visual/store'
import { renderSlides } from '@/lib/visual/renderer'
import { loadPhotoUrlsForSlideSet } from '@/lib/visual/photos'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  const access = await resolveAccess()
  if (!access) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const slideSetId = url.searchParams.get('slideSetId')?.trim()
  if (!slideSetId) {
    return NextResponse.json({ error: 'slideSetId is required' }, { status: 400 })
  }

  try {
    const slideSet = await loadSlideSet(slideSetId)
    if (slideSet.slides.length === 0) {
      return NextResponse.json(
        { error: 'slide set is empty' },
        { status: 400 }
      )
    }
    if (access.role !== 'admin' && slideSet.clinic_id !== access.clinicId) {
      return NextResponse.json(
        { error: 'slide set does not belong to your clinic' },
        { status: 403 }
      )
    }

    const photoUrls = await loadPhotoUrlsForSlideSet(
      slideSet.id,
      slideSet.slides,
      slideSet.style_template
    )
    const buffers = await renderSlides(
      slideSet.slides.map((s, i) => ({ slide: s, photoUrl: photoUrls[i] ?? null })),
      slideSet.style_template
    )

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const archive = archiver('zip', { zlib: { level: 9 } })
        archive.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
        archive.on('end', () => controller.close())
        archive.on('error', (err) => controller.error(err))

        buffers.forEach((buf, i) => {
          const idx = String(i + 1).padStart(2, '0')
          archive.append(buf, { name: `slide-${idx}.png` })
        })
        archive.finalize().catch((err) => controller.error(err))
      },
    })

    await markSlideSetStatus(slideSetId, 'exported')

    return new Response(stream, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="slides-${slideSetId}.zip"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
