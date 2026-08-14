import type { Rng } from '../engine/rng'

export interface BlockType {
  id: string
  nameDa: string
  /** CSS colors for the pseudo-3D face. */
  top: string
  side: string
  rare: boolean
  /** Unlocked once this many skills are mastered — reward follows learning. */
  unlockAt: number
}

export const BLOCKS: BlockType[] = [
  { id: 'grass', nameDa: 'græs', top: 'var(--grass)', side: 'var(--dirt)', rare: false, unlockAt: 0 },
  { id: 'dirt', nameDa: 'jord', top: 'var(--dirt)', side: 'var(--dirt-dark)', rare: false, unlockAt: 0 },
  { id: 'stone', nameDa: 'sten', top: 'var(--stone)', side: '#7d8386', rare: false, unlockAt: 0 },
  { id: 'wood', nameDa: 'træ', top: 'var(--wood)', side: '#8f6f42', rare: false, unlockAt: 0 },
  { id: 'sand', nameDa: 'sand', top: '#e8d9a8', side: '#d4c28c', rare: false, unlockAt: 3 },
  { id: 'leaves', nameDa: 'blade', top: '#8cc474', side: '#6da858', rare: false, unlockAt: 6 },
  { id: 'brick', nameDa: 'mursten', top: '#c98a72', side: '#a96a54', rare: false, unlockAt: 10 },
  { id: 'ice', nameDa: 'is', top: '#cfe8f5', side: '#a8cfe3', rare: false, unlockAt: 14 },
  { id: 'snow', nameDa: 'sne', top: '#f4f8fa', side: '#d8e4ea', rare: false, unlockAt: 18 },
  { id: 'gold', nameDa: 'guld', top: 'var(--gold)', side: '#c0a23a', rare: true, unlockAt: 0 },
  { id: 'diamond', nameDa: 'diamant', top: 'var(--diamond)', side: '#5fb8b2', rare: true, unlockAt: 4 },
  { id: 'emerald', nameDa: 'smaragd', top: '#6fd08a', side: '#4cae68', rare: true, unlockAt: 8 },
  { id: 'obsidian', nameDa: 'obsidian', top: '#4a3d5c', side: '#332a40', rare: true, unlockAt: 12 },
  { id: 'redstone', nameDa: 'rødsten', top: '#d96a5a', side: '#b34a3c', rare: true, unlockAt: 16 },
]

export const blockById = new Map(BLOCKS.map((b) => [b.id, b]))

/**
 * Every 4th correct answer earns a rare block — a small predictable jackpot.
 * The pool grows as skills get mastered, so new block types are themselves
 * a reward for learning.
 */
export function pickEarnedBlock(totalCorrect: number, masteredCount: number, rng: Rng): BlockType {
  const wantRare = totalCorrect % 4 === 0
  const unlocked = BLOCKS.filter((b) => b.unlockAt <= masteredCount)
  const pool = unlocked.filter((b) => b.rare === wantRare)
  return rng.pick(pool.length > 0 ? pool : unlocked)
}
