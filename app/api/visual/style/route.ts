import { NextResponse } from 'next/server'
import { saveStyleTemplate } from '@/lib/visual/store'
import type { VisualStyle } from '@/types'

export const runtime = 'nodejs'

interface StylePostBody {
  clinicId: string
  style: VisualStyle
}

export async function POST(req: Request) {
  let body: StylePostBody
  try {
    body = (await req.json()) as StylePostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const clinicId = body.clinicId?.trim()
  if (!clinicId || !body.style) {
    return NextResponse.json(
      { error: 'clinicId and style are required' },
      { status: 400 }
    )
  }

  if (!validateStyle(body.style)) {
    return NextResponse.json(
      { error: 'style does not match VisualStyle shape' },
      { status: 400 }
    )
  }

  try {
    const saved = await saveStyleTemplate(clinicId, body.style)
    return NextResponse.json({ slide_set_id: saved.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function validateStyle(s: VisualStyle): boolean {
  if (!s.canvas || typeof s.canvas.width !== 'number' || typeof s.canvas.height !== 'number') {
    return false
  }
  if (!s.background || !['photo', 'color'].includes(s.background.type)) return false
  if (!s.text?.primary || !s.text?.secondary) return false
  if (typeof s.padding !== 'number') return false
  return true
}
