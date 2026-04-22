import { NextResponse } from 'next/server'
import { runDiff } from '@/lib/agents/diff'
import {
  loadExportedScriptsWithoutFinal,
  saveDiffRules,
  saveFewShotExample,
  upsertScriptFinal,
} from '@/lib/supabase/context'
import { readDocContent } from '@/lib/google/drive'
import { checkCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const maxDuration = 300

interface DiffBody {
  clinicId?: string
  minDeltaChars?: number
}

export async function POST(req: Request) {
  const unauth = checkCronAuth(req)
  if (unauth) return unauth

  let body: DiffBody = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text) as DiffBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const minDelta = body.minDeltaChars ?? 30

  try {
    const scripts = await loadExportedScriptsWithoutFinal(body.clinicId)
    if (scripts.length === 0) {
      return NextResponse.json({ processed: 0, results: [] })
    }

    const results = []
    for (const s of scripts) {
      try {
        const finalText = await readDocContent(s.google_doc_id)
        const delta = Math.abs(finalText.length - s.full_script.length)
        const unchanged = finalText.trim() === s.full_script.trim()

        if (unchanged || (delta < minDelta && finalText.length > 0)) {
          await upsertScriptFinal({
            scriptId: s.id,
            clinicId: s.clinic_id,
            finalText,
          })
          results.push({ script_id: s.id, skipped: 'no-meaningful-edit' })
          continue
        }

        const diff = await runDiff({
          original: s.full_script,
          final: finalText,
        })

        const saved = await saveDiffRules(
          s.clinic_id,
          diff.patterns.map((p) => ({
            rule: p.rule,
            example_before: p.example_before,
            example_after: p.example_after,
            priority: p.priority,
          }))
        )

        if (diff.add_to_few_shot) {
          await saveFewShotExample(s.clinic_id, {
            script_text: finalText,
            why_good: 'Selected by diff agent — editor improved it significantly.',
          })
        }

        await upsertScriptFinal({
          scriptId: s.id,
          clinicId: s.clinic_id,
          finalText,
        })

        results.push({
          script_id: s.id,
          rules_saved: saved.length,
          added_to_few_shot: diff.add_to_few_shot,
        })
      } catch (e) {
        results.push({
          script_id: s.id,
          error: e instanceof Error ? e.message : 'unknown error',
        })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
