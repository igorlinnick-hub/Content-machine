import { createServerClient } from '@/lib/supabase/server'
import { loadCategories } from '@/lib/posts/categories'
import { getPhotosFromFolder, getPhotoDataUrl } from '@/lib/google/drive'
import { tgSend } from '../telegram'

// Ops's diag handoff: runs the same checks as GET /api/diag but
// without the admin-cookie gate, and posts a Telegram-friendly
// summary instead of JSON. Webhook secret already gated the request.

export interface OpsHandoffContext {
  clinicId: string
  chatId: number | string
  agentEmoji: string
  agentName: string
}

interface DriveResult {
  slug: string
  ok: boolean
  photo_count: number
  error: string | null
}

export async function runOpsDiag(ctx: OpsHandoffContext): Promise<void> {
  const env = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
    REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN,
  }

  let supaLine = '_(skipped)_'
  try {
    const supabase = createServerClient()
    const { count, error } = await supabase
      .from('clinics')
      .select('id', { count: 'exact', head: true })
    supaLine = error
      ? `🔴 ${error.message}`
      : `🟢 ${count ?? 0} clinic${count === 1 ? '' : 's'}`
  } catch (e) {
    supaLine = `🔴 ${e instanceof Error ? e.message : 'unknown'}`
  }

  const driveResults: DriveResult[] = []
  try {
    const cats = await loadCategories(ctx.clinicId)
    for (const c of cats) {
      if (!c.drive_folder_id) {
        driveResults.push({
          slug: c.slug,
          ok: false,
          photo_count: 0,
          error: 'no folder',
        })
        continue
      }
      try {
        const photos = await getPhotosFromFolder(c.drive_folder_id)
        if (photos.length === 0) {
          driveResults.push({
            slug: c.slug,
            ok: false,
            photo_count: 0,
            error: 'empty folder',
          })
          continue
        }
        const dataUrl = await getPhotoDataUrl(photos[0].id)
        driveResults.push({
          slug: c.slug,
          ok: dataUrl !== null,
          photo_count: photos.length,
          error: dataUrl ? null : 'data url failed',
        })
      } catch (e) {
        driveResults.push({
          slug: c.slug,
          ok: false,
          photo_count: 0,
          error: e instanceof Error ? e.message : 'unknown',
        })
      }
    }
  } catch (e) {
    driveResults.push({
      slug: '(load)',
      ok: false,
      photo_count: 0,
      error: e instanceof Error ? e.message : 'unknown',
    })
  }

  const envLine = Object.entries(env)
    .map(([k, v]) => `${v ? '🟢' : '🔴'} ${k}`)
    .join('\n')

  const driveLine = driveResults
    .map(
      (r) =>
        `${r.ok ? '🟢' : '🔴'} ${r.slug} — ${r.photo_count} photo${r.photo_count === 1 ? '' : 's'}${r.error ? ` (${r.error})` : ''}`
    )
    .join('\n')

  const text = [
    `${ctx.agentEmoji} *${ctx.agentName}* — diag`,
    ``,
    `*Env*`,
    envLine,
    ``,
    `*Supabase*`,
    supaLine,
    ``,
    `*Drive per category*`,
    driveLine || '_(no categories)_',
  ].join('\n')

  await tgSend(ctx.chatId, text)
}
