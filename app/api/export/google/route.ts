import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createScriptDoc } from '@/lib/google/drive'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ExportPostBody {
  scriptId: string
  folderId?: string
}

export async function POST(req: Request) {
  let body: ExportPostBody
  try {
    body = (await req.json()) as ExportPostBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const scriptId = body.scriptId?.trim()
  if (!scriptId) {
    return NextResponse.json({ error: 'scriptId is required' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const { data: script, error: loadErr } = await supabase
      .from('scripts')
      .select('id, clinic_id, topic, hook, full_script, google_doc_id, google_doc_url')
      .eq('id', scriptId)
      .single()

    if (loadErr || !script) {
      return NextResponse.json(
        { error: `script ${scriptId} not found` },
        { status: 404 }
      )
    }

    if (script.google_doc_url && script.google_doc_id) {
      return NextResponse.json({
        doc_id: script.google_doc_id,
        doc_url: script.google_doc_url,
        reused: true,
      })
    }

    const title = script.topic?.trim() || script.hook?.trim() || `Script ${script.id}`
    const { docId, docUrl } = await createScriptDoc(
      script.full_script,
      title,
      body.folderId
    )

    const { error: updateErr } = await supabase
      .from('scripts')
      .update({ google_doc_id: docId, google_doc_url: docUrl })
      .eq('id', scriptId)

    if (updateErr) throw updateErr

    return NextResponse.json({ doc_id: docId, doc_url: docUrl, reused: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
