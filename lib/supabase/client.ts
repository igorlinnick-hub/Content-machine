import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Browser client — anon key, RLS applies. Use in client components only.
export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
