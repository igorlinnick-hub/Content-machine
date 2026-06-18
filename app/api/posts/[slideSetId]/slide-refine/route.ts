import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadSlideSet } from '@/lib/visual/store'
import { fixSlide } from '@/lib/agents/slide-fixer'
import { disabledHttpResponse } from '@/lib/agents/disabled'
import type { Json } from '@/types/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Body {
  index?: number
  instruction?: string
}

export async function POST(
  req: Request,
  { params }: { params: { slideSetId: string } }
) {
  const access = await resolveAccess()
  if (!access || access.role !== 'admin') {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 })
  }

  const off = await disabledHttpResponse()
  if (off) return off

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const index = typeof body.index === 'number' ? body.index : -1
  const instruction = body.instruction?.trim() ?? ''
  if (index < 0) {
    return NextResponse.json({ error: 'index (0-based) required' }, { status: 400 })
  }
  if (!instruction) {
    return NextResponse.json({ error: 'instruction required' }, { status: 400 })
  }

  try {
    const slideSet = await loadSlideSet(params.slideSetId)
    if (index >= slideSet.slides.length) {
      return NextResponse.json(
        { error: `index ${index} out of range (have ${slideSet.slides.length} slides)` },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const { data: scriptRow } = slideSet.script_id
      ? await supabase
          .from('scripts')
          .select('topic, hook')
          .eq('id', slideSet.script_id)
          .maybeSingle()
      : { data: null }

    const fix = await fixSlide({
      slides: slideSet.slides,
      index,
      instruction,
      scriptTopic: scriptRow?.topic ?? null,
      scriptHook: scriptRow?.hook ?? null,
    })

    const updatedSlides = slideSet.slides.slice()
    updatedSlides[index] = fix.slide

    const { error: updateError } = await supabase
      .from('slide_sets')
      .update({ slides: updatedSlides as unknown as Json })
      .eq('id', params.slideSetId)
    if (updateError) throw updateError

    return NextResponse.json({
      index,
      slide: fix.slide,
      warning: fix.warning,
      slides: updatedSlides,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
