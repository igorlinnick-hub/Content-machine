import { NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadSlideSet, loadScriptForRender } from '@/lib/visual/store'
import { fixSlide } from '@/lib/agents/slide-fixer'
import { renderSlide } from '@/lib/visual/renderer'
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

    const script = slideSet.script_id
      ? await loadScriptForRender(slideSet.script_id).catch(() => null)
      : null

    const fix = await fixSlide({
      slides: slideSet.slides,
      index,
      instruction,
      scriptTopic: script?.topic ?? null,
      scriptHook: script?.hook ?? null,
    })

    const updatedSlides = slideSet.slides.slice()
    updatedSlides[index] = fix.slide_text

    const supabase = createServerClient()
    const { error: updateError } = await supabase
      .from('slide_sets')
      .update({ slides: updatedSlides as unknown as Json, status: 'rendered' })
      .eq('id', params.slideSetId)
    if (updateError) throw updateError

    // Re-render only the affected slide to keep latency low.
    const buffer = await renderSlide({
      text: fix.slide_text,
      photoUrl: null,
      style: slideSet.style_template,
      slideIndex: index,
      slideTotal: updatedSlides.length,
    })
    const preview = `data:image/png;base64,${buffer.toString('base64')}`

    return NextResponse.json({
      index,
      slide_text: fix.slide_text,
      preview,
      warning: fix.warning,
      slides: updatedSlides,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
