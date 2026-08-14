/**
 * The build-world grows with learning: every few mastered skills add space.
 * Growth never shrinks and existing cells always stay valid.
 */
export const BASE_COLS = 12
export const BASE_ROWS = 8
export const MAX_COLS = 22
export const MAX_ROWS = 14

export function worldSizeFor(masteredCount: number): { cols: number; rows: number } {
  const steps = Math.floor(masteredCount / 4)
  return {
    cols: Math.min(BASE_COLS + steps * 2, MAX_COLS),
    rows: Math.min(BASE_ROWS + steps, MAX_ROWS),
  }
}
