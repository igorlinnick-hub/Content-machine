import webpush from 'web-push'
import { createServerClient } from '@/lib/supabase/server'

// Web-push fan-out to every subscribed browser/device of a clinic
// (HANDOFF §22.2 п.9), PLUS every admin-scoped device (migration 052):
// the editor watches all clinics, so "Dr. Made recorded" and "the MAs
// uploaded" must reach the same phone regardless of which clinic was
// selected when that browser subscribed. Best-effort by design:
// missing VAPID env → silent no-op; a dead subscription (404/410 —
// browser revoked or user cleared site data) is pruned so we stop
// paying for it. Never throws — a lost notification must never fail a clip.

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

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

// The clinic's devices + the admin devices, deduped by endpoint (an
// admin browser subscribed inside a clinic is both). Falls back to the
// plain clinic query when migration 052 hasn't been applied yet — an
// unknown column must not silence every notification.
async function loadSubscriptions(clinicId: string): Promise<SubscriptionRow[]> {
  const supabase = createServerClient()
  const columns = 'id, endpoint, p256dh, auth'
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select(columns)
    .or(`clinic_id.eq.${clinicId},is_admin.is.true`)

  let rows = (data ?? []) as unknown as SubscriptionRow[]
  if (error) {
    console.warn(`push: admin-scoped lookup failed, clinic only — ${error.message}`)
    const fallback = await supabase
      .from('push_subscriptions')
      .select(columns)
      .eq('clinic_id', clinicId)
    if (fallback.error) return []
    rows = (fallback.data ?? []) as unknown as SubscriptionRow[]
  }

  const byEndpoint = new Map<string, SubscriptionRow>()
  for (const row of rows) byEndpoint.set(row.endpoint, row)
  return Array.from(byEndpoint.values())
}

// Admin devices only — for events whose screen is admin-only (the MA
// upload feed). Reuses the same fan-out, minus the clinic's own
// subscribers.
// Send to each subscription, pruning the ones the browser has revoked
// (404/410) so we stop paying for them on every future ping.
async function deliver(
  subs: SubscriptionRow[],
  payload: PushPayload
): Promise<number> {
  if (subs.length === 0) return 0
  const supabase = createServerClient()
  const body = JSON.stringify(payload)
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
      sent += 1
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.warn(
          `push: send failed (${status ?? 'no status'}) — ${e instanceof Error ? e.message : 'unknown'}`
        )
      }
    }
  }
  return sent
}

export async function sendPushToAdmins(payload: PushPayload): Promise<number> {
  if (!vapidConfigured()) return 0
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@contentmachine.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('is_admin', true)
    if (error) {
      console.warn(`push: admin lookup failed — ${error.message}`)
      return 0
    }
    return await deliver((data ?? []) as unknown as SubscriptionRow[], payload)
  } catch (e) {
    console.warn(
      `push: admin fan-out failed (non-fatal) — ${e instanceof Error ? e.message : 'unknown'}`
    )
    return 0
  }
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

    const subs = await loadSubscriptions(clinicId)
    return await deliver(subs, payload)
  } catch (e) {
    console.warn(
      `push: fan-out failed (non-fatal) — ${e instanceof Error ? e.message : 'unknown'}`
    )
    return 0
  }
}
