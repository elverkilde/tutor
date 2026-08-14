export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number
  /** Pick one element. Throws on empty array. */
  pick<T>(items: T[]): T
  /** Fisher-Yates shuffle, returns a new array. */
  shuffle<T>(items: T[]): T[]
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1))
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick from empty array')
      return items[rng.int(0, items.length - 1)]
    },
    shuffle(items) {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(0, i)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
  return rng
}
