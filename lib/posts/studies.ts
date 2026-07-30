import { MODEL_HAIKU, callAgentJSON } from '@/lib/agents/base'

// Per-post research retrieval (Igor 2026-07-30, plan (b)). Given a plan topic,
// pull 2-3 REAL, recent, quality studies from PubMed and hand them to the
// Writer so posts cite current peer-reviewed evidence instead of the model's
// static memory. Everything here is FAIL-OPEN: any error → return [] and the
// Writer falls back to the static VERIFIED FACTS block (never blocks a post).
//
// Source: NCBI E-utilities (free, no API key). We stay polite with a `tool` +
// `email` param and a small per-post request budget (1 esearch + 1 esummary +
// 1 efetch). Quality is enforced three ways: (1) PubMed publication-type filter
// (RCT / meta-analysis / systematic review / review), (2) a recency window,
// (3) a top-journal preference at the LLM selection step. An LLM builds a
// focused query and picks the best 2-3, grounding each one-line finding in the
// real abstract (it may NOT invent numbers not in the abstract).

export interface Study {
  title: string
  journal: string
  year: string
  pmid: string
  url: string
  finding: string
}

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const TOOL = 'hwc-content-machine'
const EMAIL = 'research@hawaiiwellnessclinic.com'

// Preferred journals — used only to RANK/where-tie-break at selection, never to
// hard-exclude. Keeps "не шляпа" without dropping good specialty journals.
const TOP_JOURNALS = [
  'new england journal of medicine', 'nejm', 'lancet', 'jama', 'bmj',
  'nature medicine', 'nature', 'cell metabolism', 'cell', 'science',
  'annals of internal medicine', 'circulation', 'diabetes care',
  'journal of clinical endocrinology', 'obesity', 'jama internal medicine',
  'jama psychiatry', 'american journal of psychiatry', 'pain',
]

interface Summary {
  pmid: string
  title: string
  journal: string
  year: string
  pubtypes: string[]
}

async function getJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`PubMed ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

async function getText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`PubMed ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function eutilsUrl(fn: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ tool: TOOL, email: EMAIL, ...params })
  return `${EUTILS}/${fn}?${q.toString()}`
}

async function esearch(term: string, retmax = 12): Promise<string[]> {
  const url = eutilsUrl('esearch.fcgi', {
    db: 'pubmed',
    retmode: 'json',
    retmax: String(retmax),
    sort: 'relevance',
    term,
  })
  const j = (await getJson(url)) as {
    esearchresult?: { idlist?: string[] }
  }
  return Array.isArray(j.esearchresult?.idlist) ? j.esearchresult!.idlist! : []
}

async function esummary(ids: string[]): Promise<Summary[]> {
  if (!ids.length) return []
  const url = eutilsUrl('esummary.fcgi', {
    db: 'pubmed',
    retmode: 'json',
    id: ids.join(','),
  })
  const j = (await getJson(url)) as {
    result?: Record<string, unknown>
  }
  const result = j.result ?? {}
  const out: Summary[] = []
  for (const pmid of ids) {
    const r = result[pmid] as
      | {
          title?: string
          fulljournalname?: string
          source?: string
          sortpubdate?: string
          pubdate?: string
          pubtype?: string[]
        }
      | undefined
    if (!r || !r.title) continue
    const dateStr = r.sortpubdate || r.pubdate || ''
    const year = (dateStr.match(/\d{4}/)?.[0]) ?? ''
    out.push({
      pmid,
      title: r.title.replace(/\.$/, ''),
      journal: r.fulljournalname || r.source || '',
      year,
      pubtypes: Array.isArray(r.pubtype) ? r.pubtype : [],
    })
  }
  return out
}

// Best-effort abstracts (plain text). Loosely split by the blank-line records
// efetch returns; we only need a snippet per PMID for grounding the finding.
async function efetchAbstracts(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {}
  const url = eutilsUrl('efetch.fcgi', {
    db: 'pubmed',
    rettype: 'abstract',
    retmode: 'text',
    id: ids.join(','),
  })
  const text = await getText(url)
  // Records are separated by blank lines and start with a citation line;
  // we can't reliably key them to PMIDs from plain text, so return the whole
  // blob keyed by a sentinel and let the selector see all abstracts inline.
  return { __all__: text.slice(0, 8000) }
}

async function buildQuery(topic: string, keyword: string | null): Promise<string> {
  try {
    const out = await callAgentJSON<{ query?: string }>({
      model: MODEL_HAIKU,
      systemPrompt:
        'You turn a clinic post topic into a focused PubMed search phrase. Output the core boolean term only (drug/condition/mechanism + key qualifiers), no field tags, no date filters — those are added by the caller. Prefer the medical term over lay phrasing. Respond ONLY as JSON {"query":"..."}.',
      userContent: `Topic: ${topic}\nKeyword: ${keyword ?? 'n/a'}\n\nExamples:\n- "Why your cells lose energy after forty" (NAD+) -> {"query":"NAD+ AND (aging OR mitochondrial function OR cellular senescence)"}\n- "Tirzepatide vs semaglutide" -> {"query":"tirzepatide AND semaglutide AND weight loss"}\n\nEmit the query now.`,
      maxTokens: 200,
    })
    const q = (out?.query ?? '').trim()
    return q.length > 3 ? q : (keyword || topic)
  } catch {
    return keyword || topic
  }
}

async function selectStudies(
  topic: string,
  candidates: Array<Summary & { abstractBlob: string }>
): Promise<Study[]> {
  const list = candidates
    .map(
      (c, i) =>
        `[${i}] PMID ${c.pmid} | ${c.year} | ${c.journal} | types: ${c.pubtypes.join(', ') || 'n/a'}\n    ${c.title}`
    )
    .join('\n')
  const abstracts = candidates[0]?.abstractBlob ?? ''
  try {
    const out = await callAgentJSON<{
      studies?: Array<{ index?: number; pmid?: string; finding?: string }>
    }>({
      model: MODEL_HAIKU,
      systemPrompt:
        'You are a medical research editor for a wellness clinic. From candidate PubMed studies, pick the 2-3 MOST relevant and highest-quality for the topic. Quality order: meta-analysis / systematic review / RCT > cohort; recent > old; top journals (NEJM, Lancet, JAMA, Nature Medicine, Cell Metabolism, etc.) preferred. DROP anything off-topic, animal-only, or weak. For each pick, write ONE plain-language finding line that a patient could read — grounded ONLY in the abstract text provided; NEVER invent a statistic that is not in the abstract; hedge ("suggests", "associated with"). Respond ONLY as JSON {"studies":[{"index":<n>,"finding":"..."}]}.',
      userContent: `Topic: ${topic}\n\nCandidates:\n${list}\n\nAbstracts (for grounding findings; may be unlabelled — match by content):\n${abstracts}\n\nPick the best 2-3 now.`,
      maxTokens: 700,
    })
    const picks = Array.isArray(out?.studies) ? out!.studies! : []
    const chosen: Study[] = []
    for (const p of picks) {
      const c =
        typeof p.index === 'number' && candidates[p.index]
          ? candidates[p.index]
          : candidates.find((x) => x.pmid === p.pmid)
      if (!c) continue
      const finding = (p.finding ?? '').trim()
      if (!finding) continue
      chosen.push({
        title: c.title,
        journal: c.journal,
        year: c.year,
        pmid: c.pmid,
        url: `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`,
        finding,
      })
      if (chosen.length >= 3) break
    }
    return chosen
  } catch {
    return []
  }
}

export async function fetchStudiesForTopic(params: {
  topic: string
  keyword?: string | null
}): Promise<Study[]> {
  const { topic } = params
  if (!topic || !topic.trim()) return []
  try {
    const core = await buildQuery(topic, params.keyword ?? null)
    const typeFilter =
      '(Meta-Analysis[ptyp] OR systematic[sb] OR Randomized Controlled Trial[ptyp] OR Clinical Trial[ptyp] OR Review[ptyp])'
    // Primary: quality types + last 7 years, human, English.
    let ids = await esearch(
      `(${core}) AND ${typeFilter} AND ("last 7 years"[dp]) AND English[lang] AND humans[mesh]`
    )
    // Relax once if empty: drop the type filter, widen to 10 years.
    if (ids.length === 0) {
      ids = await esearch(`(${core}) AND ("last 10 years"[dp]) AND English[lang]`)
    }
    ids = ids.slice(0, 10)
    if (!ids.length) return []

    const [sums, abs] = await Promise.all([esummary(ids), efetchAbstracts(ids)])
    if (!sums.length) return []
    const blob = abs.__all__ ?? ''
    const candidates = sums.map((s) => ({ ...s, abstractBlob: blob }))
    const studies = await selectStudies(topic, candidates)
    return studies
  } catch (e) {
    console.warn(
      `[studies] retrieval failed, proceeding with static facts: ${
        e instanceof Error ? e.message : 'unknown'
      }`
    )
    return []
  }
}

// Render the studies as a Writer-prompt block. Empty when none found.
export function studiesPromptBlock(studies: Study[]): string {
  if (!studies.length) return ''
  const lines = studies
    .map(
      (s) =>
        `- ${s.title} (${s.journal}, ${s.year}; PMID ${s.pmid}) — ${s.finding}`
    )
    .join('\n')
  return `\n\nREAL STUDIES (retrieved from PubMed for THIS topic — use these as the evidence, do not invent others):
${lines}

Rules for using them:
- On the "What the data shows" slide, give EACH study its OWN short bullet line
  (research-statement style, one crisp line: "A 2024 Cell Metabolism trial — NMN
  improved insulin sensitivity in older adults"). One study per line so they
  render as SEPARATE bullets with spacing between them — never a run-on prose
  paragraph and never a citation dump.
- Keep each line short (≤14 words); name the journal or trial + year in-line.
- Put the full citation (title, journal, year, PMID) in the SOURCES section for
  internal review (never rendered publicly).
- State ONLY what these studies support; hedge ("suggests", "associated with");
  never overstate or invent a statistic not in the finding above.`
}
