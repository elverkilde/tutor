import { describe, expect, it } from 'vitest'
import { BASE_COLS, BASE_ROWS, MAX_COLS, MAX_ROWS, worldSizeFor } from './world'

describe('worldSizeFor', () => {
  it('starts at base size and never shrinks as mastery grows', () => {
    expect(worldSizeFor(0)).toEqual({ cols: BASE_COLS, rows: BASE_ROWS })
    let prev = worldSizeFor(0)
    for (let m = 1; m <= 40; m++) {
      const next = worldSizeFor(m)
      expect(next.cols).toBeGreaterThanOrEqual(prev.cols)
      expect(next.rows).toBeGreaterThanOrEqual(prev.rows)
      prev = next
    }
  })

  it('caps at the maximum size', () => {
    expect(worldSizeFor(1000)).toEqual({ cols: MAX_COLS, rows: MAX_ROWS })
  })

  it('grows at the first threshold', () => {
    expect(worldSizeFor(4).cols).toBeGreaterThan(BASE_COLS)
  })
})
