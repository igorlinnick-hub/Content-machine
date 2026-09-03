import type { Skin } from '../types'
import { style3 } from './style3'

// Style id → skin. Ids match lib/posts/style-templates.ts (the Canva masters)
// so a post keeps ONE style identity no matter which renderer draws it.
//
// R1 ships Style 3 only, on purpose: prove the craft on one skin against its
// Canva twin before porting the other four (Igor 2026-08-13).
const SKINS: Record<number, Skin> = {
  3: style3,
}

export function skinForStyle(styleId: number): Skin {
  const skin = SKINS[styleId]
  if (!skin) {
    throw new Error(
      `no in-house skin for style ${styleId} — R1 covers Style 3 only; compose this post in Canva or add a skin`
    )
  }
  return skin
}

export function availableSkinIds(): number[] {
  return Object.keys(SKINS).map(Number)
}
