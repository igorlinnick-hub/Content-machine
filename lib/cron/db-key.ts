import { timingSafeEqual } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'

// Auth for routes ticked by pg_cron inside Supabase (Vercel Hobby crons fire
// once a day at most). The job sends `x-cron-key`; the expected value lives in
// app_secrets (migration 060), readable by the service role only — so the
// secret never has to be copied into Vercel env.
export async function dbCronKeyMatches(req: Request): Promise<boolean> {
  const key = req.headers.get('x-cron-key')
  if (!key) return false
  const { data } = await createServerClient()
    .from('app_secrets')
    .select('value')
    .eq('name', 'meta_publish_cron')
    .maybeSingle()
  const expected = (data as { value: string } | null)?.value ?? ''
  const a = Buffer.from(key)
  const b = Buffer.from(expected)
  return expected.length > 0 && a.length === b.length && timingSafeEqual(a, b)
}
