#!/usr/bin/env node
// Cliché / AI-tell check for any English post text — the same scan the Critic
// runs on generated scripts (lib/agents/teaser-lines.ts). Use it on copy written
// by hand or in a Claude session (HireDrop, Yedino, captions) before it ships.
//
//   node scripts/slop-check.mjs post.md            # a file
//   node scripts/slop-check.mjs --text "copy..."   # inline
//   pbpaste | node scripts/slop-check.mjs          # stdin
//
// Exit 0 = clean, 1 = hits found. English only: Russian text always passes.
import fs from 'fs'
import { fileURLToPath } from 'url'

const lib = fileURLToPath(new URL('../lib/agents/teaser-lines.ts', import.meta.url))
const { findTeaserLines, findClicheLines } = await import(lib)

const args = process.argv.slice(2)
const text =
  args[0] === '--text' ? args.slice(1).join(' ')
  : args[0] ? fs.readFileSync(args[0], 'utf8')
  : fs.readFileSync(0, 'utf8')

const teasers = findTeaserLines(text)
const cliches = findClicheLines(text)

if (!teasers.length && !cliches.length) {
  console.log('clean — no teaser lines or clichés found (the scan is a floor: still read it)')
  process.exit(0)
}
if (teasers.length) {
  console.log(`TEASER lines (${teasers.length}) — cut; say the actual claim:`)
  teasers.forEach((s) => console.log(`  • ${s}`))
}
if (cliches.length) {
  console.log(`CLICHÉS (${cliches.length}) — rewrite as the concrete thing:`)
  cliches.forEach((s) => console.log(`  • ${s}`))
}
process.exit(1)
