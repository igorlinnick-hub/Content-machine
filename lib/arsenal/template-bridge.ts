import { insertScriptTemplate, type ScriptTemplate } from '@/lib/posts/templates'
import type { ArsenalRow } from './store'

// Bridges an arsenal entry into the existing script_templates table.
// Arsenal rows describe a *style pattern* (beats + hooks + pains
// borrowed from a real reference video); script_templates store
// *scaffolds* the writer fills in. The bridge converts the former
// into the latter by walking the structure.beats and producing a
// templated scaffold string. The arsenal row stays put — this is a
// one-way snapshot, so the operator can keep evolving the arsenal
// entry while a frozen template fuels Writer.

function bracketed(label: string, body: string | null | undefined): string {
  const trimmed = (body ?? '').trim()
  if (!trimmed) return `[${label}]`
  return `[${label} — ${trimmed}]`
}

export function arsenalToScaffold(arsenal: ArsenalRow): string {
  // When the source queue row had intent='template_for_clinic', the
  // skill already wrote a clinic-tailored scaffold — use that verbatim
  // so the Templates tab shows the *applied* version (with the
  // clinic's niche / services baked in) rather than a generic beat
  // list derived from the foreign source video.
  const proposal = arsenal.clinic_template_proposal?.trim() ?? ''
  if (proposal) return proposal

  const beats = arsenal.structure?.beats ?? []
  if (beats.length === 0) {
    // Fall back to a minimal hook+CTA shape so an in-progress arsenal
    // row (visual analysed but structure not yet extracted) still
    // produces a usable template.
    const hook = arsenal.hooks?.[0]?.text ?? null
    return [
      bracketed('Hook', hook),
      bracketed('Body', arsenal.style_description ?? null),
      bracketed('CTA', null),
    ].join('\n')
  }
  return beats
    .map((b) => bracketed(b.name.replace(/_/g, ' '), b.text))
    .join('\n')
}

export async function saveArsenalAsTemplate(
  arsenal: ArsenalRow
): Promise<ScriptTemplate> {
  const scaffold = arsenalToScaffold(arsenal)
  const name = `arsenal:${arsenal.style_label}`.slice(0, 80)
  // Compose a description so the operator scanning the Templates tab
  // recognises which arsenal row produced it. The arsenal entry can
  // be later toggled / renamed independently. When the row carries a
  // clinic-template note, surface that first since it explains the
  // mapping the skill made.
  const description = [
    arsenal.clinic_template_note ?? '',
    arsenal.style_description ?? '',
    arsenal.source_url ? `(from ${arsenal.source_platform ?? '?'} ${arsenal.source_url})` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return insertScriptTemplate(arsenal.clinic_id, {
    name,
    description: description || null,
    scaffold,
    length_bias: null,
  })
}
