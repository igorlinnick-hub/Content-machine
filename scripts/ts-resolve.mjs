// Resolve hook: lets plain `node` run the repo's .ts modules, whose imports
// are extensionless (`./types`) the way TypeScript writes them. Node 24
// strips the types itself but will not guess the extension, so we do.
// Used only by local preview scripts — nothing in the app depends on it.
import { existsSync } from 'node:fs'

const CANDIDATES = ['.ts', '.tsx', '/index.ts']

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL)
    for (const ext of CANDIDATES) {
      const candidate = new URL(base.href + ext)
      if (existsSync(candidate)) return nextResolve(candidate.href, context)
    }
  }
  return nextResolve(specifier, context)
}
