import type { RecentScript } from '@/lib/supabase/context'

interface RecentScriptsProps {
  scripts: RecentScript[]
}

export function RecentScripts({ scripts }: RecentScriptsProps) {
  if (scripts.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No scripts yet. Use the generator above to create the first batch.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
      {scripts.map((s) => (
        <li key={s.id} className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {s.topic ?? 'Untitled'}
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {s.hook ?? '—'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {formatDate(s.created_at)} · {s.word_count ?? '?'} words
              {typeof s.critic_score === 'number'
                ? ` · ${s.critic_score.toFixed(1)}/10`
                : ''}
              {s.approved ? ' · approved' : ''}
            </p>
          </div>
          {s.google_doc_url ? (
            <a
              href={s.google_doc_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Google Doc
            </a>
          ) : (
            <span className="shrink-0 text-xs text-neutral-400">not exported</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
