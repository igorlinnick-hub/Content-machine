import { createServerClient } from '@/lib/supabase/server'
import { loadSlideSet } from '@/lib/visual/store'
import { renderSlides } from '@/lib/visual/renderer'
import { loadPhotoUrlsForSlideSet } from '@/lib/visual/photos'
import { tgChatAction, tgSend, tgSendMediaGroup } from '../telegram'

// Tilda's re-render handoff: take an existing slide_set (latest if
// no id given), refresh its photos from Drive, re-render PNGs, post
// the album. Used after a style tweak or stale-photo refresh.

export interface TildaReRenderParams {
  slide_set_id?: string
}

export interface TildaHandoffContext {
  clinicId: string
  chatId: number | string
  agentEmoji: string
  agentName: string
}

async function pickLatestSlideSetId(clinicId: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('slide_sets')
    .select('id')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function runTildaReRender(
  params: TildaReRenderParams,
  ctx: TildaHandoffContext
): Promise<void> {
  const slideSetId =
    params.slide_set_id?.trim() || (await pickLatestSlideSetId(ctx.clinicId))
  if (!slideSetId) {
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\nNo slide set to re-render — there are no posts in this clinic yet.`
    )
    return
  }

  await tgChatAction(ctx.chatId, 'upload_photo')

  try {
    const slideSet = await loadSlideSet(slideSetId)
    const photoUrls = await loadPhotoUrlsForSlideSet(
      slideSetId,
      slideSet.slides,
      slideSet.style_template
    )
    const buffers = await renderSlides(
      slideSet.slides.map((s, i) => ({ slide: s, photoUrl: photoUrls[i] })),
      slideSet.style_template
    )

    const reviewBase = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const reviewLink = `${reviewBase}/posts/${slideSetId}`
    const caption = `${ctx.agentEmoji} *${ctx.agentName}* re-rendered set ${slideSetId.slice(0, 8)}\n\nReview: ${reviewLink}`
    const album = await tgSendMediaGroup(ctx.chatId, buffers, caption)
    if (!album.ok) {
      await tgSend(
        ctx.chatId,
        caption +
          `\n\n_(media group failed status=${album.status}, slides at the link above)_`
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await tgSend(
      ctx.chatId,
      `${ctx.agentEmoji} *${ctx.agentName}*\n\n_(re-render failed: ${msg})_`
    )
  }
}
