import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Server client — service_role key, bypasses RLS.
// Used by API routes, agents, cron jobs. App code must scope queries by clinic_id.
// Never import into client components.
export function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
