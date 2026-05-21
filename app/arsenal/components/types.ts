import type { ArsenalRow } from '@/lib/arsenal/store'

// Server-decorated arsenal row — public URLs are derived from
// storage_path columns in app/arsenal/page.tsx so the client never
// needs to know about the bucket. Shared across components so we
// avoid a circular type-import between Workspace and its children.
export type DecoratedArsenalRow = ArsenalRow & {
  video_url: string | null
  thumbnail_url: string | null
}
