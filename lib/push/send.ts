import webpush from 'web-push'
import { createServerClient } from '@/lib/supabase/server'

// Web-push fan-out to every subscribed browser/device of a clinic
// (HANDOFF §22.2 п.9). Best-effort by design: missing VAPID env →
// silent no-op; a dead subscription (404/410 — browser revoked or
// user cleared site data) is pruned so we stop paying for it.
// Never throws — a lost notification must never fail a clip.

export interface PushPayload {
  title: string
  body: string
  url: string
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  )
}

export async function sendPushToClinic(
  clinicId: string,
  payload: PushPayload
): Promise<number> {
  if (!vapidConfigured()) return 0

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@contentmachine.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    const supabase = createServerClient()
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('clinic_id', clinicId)
    if (error || !subs || subs.length === 0) return 0

    const body = JSON.stringify(payload)
    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          body
        )
        sent += 1
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id as string)
        } else {
          console.warn(
            `push: send failed (${status ?? 'no status'}) — ${e instanceof Error ? e.message : 'unknown'}`
          )
        }
      }
    }
    return sent
  } catch (e) {
    console.warn(
      `push: fan-out failed (non-fatal) — ${e instanceof Error ? e.message : 'unknown'}`
    )
    return 0
  }
}
