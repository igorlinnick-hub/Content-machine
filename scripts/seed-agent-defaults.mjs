// Seed initial agent_preferences rows for a clinic. Idempotent —
// safe to re-run. Skips agent_prompts on purpose: prompt overrides
// should be added by the operator through Telegram feedback (saved
// as agent_learnings, then promoted to a prompt override by Claude
// Code in a later session).
//
// Usage:
//   node scripts/seed-agent-defaults.mjs --clinicId=<uuid>
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
// the local .env.local (load via `--env-file=.env.local`).

import { createClient } from '@supabase/supabase-js'

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.+)$/)
    return m ? [[m[1], m[2]]] : []
  })
)
const clinicId = args.clinicId
if (!clinicId) {
  console.error('missing --clinicId=<uuid>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(
    'missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env'
  )
  process.exit(1)
}

const supa = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const defaults = [
  { agent_key: 'marek', prefs: { default_length: 'short', auto_render_carousel: true } },
  { agent_key: 'tilda', prefs: { ask_brand_question_when_ambiguous: true } },
  { agent_key: 'ren', prefs: { paused: true, paused_reason: '§18 addendum: testing in playground first' } },
  { agent_key: 'iris', prefs: { default_max_sources: 5 } },
  { agent_key: 'vex', prefs: { alert_threshold_usd: 50 } },
  { agent_key: 'ops', prefs: {} },
]

for (const d of defaults) {
  const { data: existing } = await supa
    .from('agent_preferences')
    .select('id, prefs')
    .eq('clinic_id', clinicId)
    .eq('agent_key', d.agent_key)
    .maybeSingle()
  if (existing) {
    const merged = { ...(existing.prefs ?? {}), ...d.prefs }
    const { error } = await supa
      .from('agent_preferences')
      .update({ prefs: merged, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) {
      console.error(`update ${d.agent_key} failed:`, error.message)
      process.exit(1)
    }
    console.log(`updated ${d.agent_key}`)
  } else {
    const { error } = await supa
      .from('agent_preferences')
      .insert({ clinic_id: clinicId, agent_key: d.agent_key, prefs: d.prefs })
    if (error) {
      console.error(`insert ${d.agent_key} failed:`, error.message)
      process.exit(1)
    }
    console.log(`inserted ${d.agent_key}`)
  }
}

console.log('done.')
