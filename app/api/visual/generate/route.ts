import { NextResponse } from 'next/server'
import { splitScriptToSlides } from '@/lib/visual/slides'
import { renderSlides } from '@/lib/visual/renderer'
import {
  createSlideSet,
  loadScriptForRender,
  loadStyleTemplate,
} from '@/lib/visual/store'
import { getPhotosFromFolder } from '@/lib/google/drive'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const maxDuration = 300

interface GeneratePostBody {
  scriptId: string
  photoFolderId?: string
  returnPreview?: boolean
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  let body: GeneratePostBody
  try {
    body = (await req.json()) as GeneratePostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const scriptId = body.scriptId?.trim()
  if (!scriptId) {
    return NextResponse.json({ error: 'scriptId is required' }, { status: 400 })
  }

  try {
    const script = await loadScriptForRender(scriptId)
    const style = await loadStyleTemplate(script.clinic_id)

    const { slides } = await splitScriptToSlides(script.full_script)

    let photoUrls: (string | null)[] = slides.map(() => null)
    if (body.photoFolderId && style.background.type === 'photo') {
      try {
        const photos = await getPhotosFromFolder(body.photoFolderId)
        if (photos.length > 0) {
          photoUrls = slides.map(
            (_, i) => photos[i % photos.length]?.webContentLink ?? null
          )
        }
      } catch {
        photoUrls = slides.map(() => null)
      }
    }

    const buffers = await renderSlides(
      slides.map((text, i) => ({ text, photoUrl: photoUrls[i] })),
      style
    )

    const slideSet = await createSlideSet({
      clinicId: script.clinic_id,
      scriptId: script.id,
      slides,
      styleTemplate: style,
      driveFolderId: body.photoFolderId ?? null,
      status: 'rendered',
    })

    const returnPreview = body.returnPreview !== false
    const previews = returnPreview
      ? buffers.map((b) => `data:image/png;base64,${b.toString('base64')}`)
      : []

    return NextResponse.json({
      slide_set_id: slideSet.id,
      slide_count: slides.length,
      slides,
      previews,
      download_url: `/api/visual/download?slideSetId=${slideSet.id}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
