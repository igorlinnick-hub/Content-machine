import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveAccess } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Store / remove a browser's push subscription (HANDOFF §22.2 п.9).
// Called by app/components/PushToggle.tsx after the user grants
// notification permission. Admins pass ?clinicId=…, clinic sessions
// use their own clinic.

interface SubscriptionBody {
  subscription?: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
}

function resolveClinicId(
  access: { role: string; clinicId?: string },
  url: URL
): string {
  return access.role === 'admin'
    ? url.searchParams.get('clinicId') ?? ''
    : ((access as { clinicId: string }).clinicId ?? '')
}

export async function POST(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const clinicId = resolveClinicId(access, new URL(req.url))
  if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })

  let body: SubscriptionBody
  try {
    body = (await req.json()) as SubscriptionBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const endpoint = body.subscription?.endpoint
  const p256dh = body.subscription?.keys?.p256dh
  const auth = body.subscription?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  }

  const supabase = createServerClient()
  // Endpoint is unique per browser — re-subscribing moves the row to
  // the current clinic and refreshes keys.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      clinic_id: clinicId,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const access = await resolveAccess()
  if (!access) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: { endpoint?: string }
  try {
    body = (await req.json()) as { endpoint?: string }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  const supabase = createServerClient()
  await supabase.from('push_subscriptions').delete().eq('endpoint', body.endpoint)
  return NextResponse.json({ ok: true })
}
