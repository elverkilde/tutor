import { describe, expect, it } from 'vitest'
import skillsJson from '../data/skills.json'
import type { Skill } from '../engine/types'
import { tapMore } from './tap-more'
import { dragToChest } from './drag-to-chest'
import { numeralMatch } from './numeral-match'
import { towerBuild } from './tower-build'
import { tensAndOnes } from './tens-and-ones'
import { numberLineHop } from './number-line-hop'
import { lineAdd } from './line-add'
import { gatherSum } from './gather-sum'
import { patternContinue } from './pattern-continue'
import { combineCount } from './combine-count'
import { takeAway } from './take-away'
import { equation } from './equation'

// Import the templates' pure halves directly — the Views need a DOM, the
// generators don't.
const skills = skillsJson as Skill[]
const SEEDS = 300

function bindingsFor(templateId: string) {
  return skills.flatMap((s) =>
    s.templates.filter((t) => t.templateId === templateId).map((t) => ({ skill: s, ...t })),
  )
}

describe('tap-more generation', () => {
  it('always produces two distinct quantities respecting range and gap', () => {
    for (const b of bindingsFor('tap-more')) {
      const [min, max] = b.params['range'] as number[]
      const minGap = b.params['minGap'] as number
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = tapMore.generateTrial(b.skill.id, b.params, seed)
        const { left, right, asDigits } = spec.data
        expect(Math.abs(left - right)).toBeGreaterThanOrEqual(minGap)
        expect(asDigits).toBe(b.params['asDigits'] === true)
        for (const v of [left, right]) {
          expect(v).toBeGreaterThanOrEqual(min)
          expect(v).toBeLessThanOrEqual(max)
        }
      }
    }
  })

  it('same seed reproduces the same trial (scaffolded retries keep the numbers)', () => {
    const b = bindingsFor('tap-more')[0]
    const a = tapMore.generateTrial(b.skill.id, b.params, 99)
    const c = tapMore.generateTrial(b.skill.id, b.params, 99)
    expect(a.data).toEqual(c.data)
  })

  it('scaffold turns on the cross-representation hint without changing quantities', () => {
    const b = bindingsFor('tap-more')[0]
    const spec = tapMore.generateTrial(b.skill.id, b.params, 7)
    const scaffolded = tapMore.applyScaffold(spec, 1)
    expect(scaffolded.data.hint).toBe(true)
    expect(scaffolded.data.left).toBe(spec.data.left)
    expect(scaffolded.data.right).toBe(spec.data.right)
  })
})

describe('numeral-match generation', () => {
  it('produces the requested number of valid, unique choices including the answer', () => {
    for (const b of bindingsFor('numeral-match')) {
      const [min, max] = b.params['range'] as number[]
      const choiceCount = b.params['choices'] as number
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = numeralMatch.generateTrial(b.skill.id, b.params, seed)
        const { count, choices } = spec.data
        expect(count).toBeGreaterThanOrEqual(min)
        expect(count).toBeLessThanOrEqual(max)
        expect(choices).toContain(count)
        expect(new Set(choices).size).toBe(choices.length)
        expect(choices).toHaveLength(choiceCount)
      }
    }
  })

  it('scaffold reduces to two choices and keeps the answer', () => {
    const b = bindingsFor('numeral-match').find((x) => (x.params['choices'] as number) > 2)!
    const spec = numeralMatch.generateTrial(b.skill.id, b.params, 13)
    const scaffolded = numeralMatch.applyScaffold(spec, 1)
    expect(scaffolded.data.choices).toHaveLength(2)
    expect(scaffolded.data.choices).toContain(spec.data.count)
  })

  it('teen bindings count aloud and use the counting prompt', () => {
    const aloud = bindingsFor('numeral-match').filter((x) => x.params['countAloud'] === true)
    expect(aloud.length).toBeGreaterThan(0)
    for (const b of aloud) {
      const spec = numeralMatch.generateTrial(b.skill.id, b.params, 5)
      expect(spec.data.countAloud).toBe(true)
      expect(spec.promptPhrase.key).toBe('numeralCount')
    }
    const silent = bindingsFor('numeral-match').find((x) => x.params['countAloud'] !== true)!
    const spec = numeralMatch.generateTrial(silent.skill.id, silent.params, 5)
    expect(spec.data.countAloud).toBe(false)
    expect(spec.promptPhrase.key).toBe('numeralMatch')
  })
})

describe('tens-and-ones generation', () => {
  it('decomposes the target into rods and ones; spares exist; a rod is always required', () => {
    for (const b of bindingsFor('tens-and-ones')) {
      const [min, max] = b.params['range'] as number[]
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = tensAndOnes.generateTrial(b.skill.id, b.params, seed)
        const { target, tens, ones, rodsAvailable, singlesAvailable } = spec.data
        expect(target).toBeGreaterThanOrEqual(min)
        expect(target).toBeLessThanOrEqual(max)
        expect(tens * 10 + ones).toBe(target)
        expect(tens).toBeGreaterThanOrEqual(1)
        expect(rodsAvailable).toBeGreaterThanOrEqual(tens)
        // Spare singles exist, but never enough to reach the target without a rod.
        expect(singlesAvailable).toBeGreaterThan(ones)
        expect(singlesAvailable).toBeLessThan(target)
        expect(spec.promptPhrase.n).toBe(target)
      }
    }
  })

  it('scaffold shows the decomposition slots without changing quantities', () => {
    const b = bindingsFor('tens-and-ones')[0]
    const spec = tensAndOnes.generateTrial(b.skill.id, b.params, 21)
    const scaffolded = tensAndOnes.applyScaffold(spec, 1)
    expect(scaffolded.data.showSlots).toBe(true)
    expect(scaffolded.data.target).toBe(spec.data.target)
    expect(scaffolded.data.tens).toBe(spec.data.tens)
    expect(scaffolded.data.ones).toBe(spec.data.ones)
  })
})

describe('drag-to-chest generation', () => {
  it('target respects range, spare blocks always exist, silent mode changes the prompt', () => {
    for (const b of bindingsFor('drag-to-chest')) {
      const [min, max] = b.params['range'] as number[]
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = dragToChest.generateTrial(b.skill.id, b.params, seed)
        const { target, available } = spec.data
        expect(target).toBeGreaterThanOrEqual(min)
        expect(target).toBeLessThanOrEqual(max)
        expect(available).toBeGreaterThan(target)
        if (b.params['silent'] === true) {
          expect(spec.promptPhrase.key).toBe('dragToChestSign')
        } else {
          expect(spec.promptPhrase.n).toBe(target)
        }
      }
    }
  })
})

describe('tower-build generation', () => {
  it('target respects range and scaffold adds the ghost without changing it', () => {
    for (const b of bindingsFor('tower-build')) {
      const [min, max] = b.params['range'] as number[]
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = towerBuild.generateTrial(b.skill.id, b.params, seed)
        expect(spec.data.target).toBeGreaterThanOrEqual(min)
        expect(spec.data.target).toBeLessThanOrEqual(max)
        const scaffolded = towerBuild.applyScaffold(spec, 1)
        expect(scaffolded.data.showGhost).toBe(true)
        expect(scaffolded.data.target).toBe(spec.data.target)
      }
    }
  })
})

describe('number-line-hop generation', () => {
  it('answers stay on the line for every mode', () => {
    for (const b of bindingsFor('number-line-hop')) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = numberLineHop.generateTrial(b.skill.id, b.params, seed)
        const { line, answer, spoken, mode } = spec.data
        expect(line).toContain(answer)
        expect(line).toContain(spoken)
        if (mode === 'after') expect(answer).toBe(spoken + 1)
        if (mode === 'before') expect(answer).toBe(spoken - 1)
        if (mode === 'goto') expect(answer).toBe(spoken)
      }
    }
  })

  it('scaffold restricts active tiles to a window around the answer', () => {
    const b = bindingsFor('number-line-hop')[0]
    const spec = numberLineHop.generateTrial(b.skill.id, b.params, 5)
    const scaffolded = numberLineHop.applyScaffold(spec, 1)
    expect(scaffolded.data.active).toContain(spec.data.answer)
    expect(scaffolded.data.active!.length).toBeLessThanOrEqual(3)
  })
})

describe('line-add generation', () => {
  it('start, hops and landing all stay on the line', () => {
    for (const b of bindingsFor('line-add')) {
      const lineMax = b.params['lineMax'] as number
      const maxHops = b.params['maxHops'] as number
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = lineAdd.generateTrial(b.skill.id, b.params, seed)
        const { line, start, hops, answer } = spec.data
        expect(start).toBeGreaterThanOrEqual(1)
        expect(hops).toBeGreaterThanOrEqual(1)
        expect(hops).toBeLessThanOrEqual(maxHops)
        expect(answer).toBe(start + hops)
        expect(answer).toBeLessThanOrEqual(lineMax)
        expect(line).toContain(answer)
        expect(spec.promptPhrase.n).toBe(start)
        expect(spec.promptPhrase.n2).toBe(hops)
      }
    }
  })

  it('scaffold shows the hop path without changing the numbers', () => {
    const b = bindingsFor('line-add')[0]
    const spec = lineAdd.generateTrial(b.skill.id, b.params, 17)
    const scaffolded = lineAdd.applyScaffold(spec, 1)
    expect(scaffolded.data.showPath).toBe(true)
    expect(scaffolded.data.start).toBe(spec.data.start)
    expect(scaffolded.data.hops).toBe(spec.data.hops)
  })
})

describe('pattern-continue generation', () => {
  it('the sequence truly repeats its unit and the answer continues it', () => {
    for (const b of bindingsFor('pattern-continue')) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = patternContinue.generateTrial(b.skill.id, b.params, seed)
        const { sequence, answer, choices, unitLength } = spec.data
        for (let i = unitLength; i < sequence.length; i++) {
          expect(sequence[i]).toBe(sequence[i - unitLength])
        }
        expect(answer).toBe(sequence[sequence.length - unitLength])
        expect(choices).toContain(answer)
        expect(new Set(choices).size).toBe(choices.length)
        expect(choices.length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('addsub generation', () => {
  it('gather-sum addends are positive, distinct in type, and within maxSum', () => {
    for (const b of bindingsFor('gather-sum')) {
      const maxSum = b.params['maxSum'] as number
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = gatherSum.generateTrial(b.skill.id, b.params, seed)
        const { a, b: bb, typeA, typeB, answer, choices } = spec.data
        expect(a).toBeGreaterThanOrEqual(1)
        expect(bb).toBeGreaterThanOrEqual(1)
        expect(a + bb).toBe(answer)
        expect(answer).toBeLessThanOrEqual(maxSum)
        expect(typeA).not.toBe(typeB)
        expect(choices).toContain(answer)
        expect(new Set(choices).size).toBe(choices.length)
      }
    }
  })

  it('gather-sum scaffold reduces to two choices and keeps the answer', () => {
    const b = bindingsFor('gather-sum')[0]
    const spec = gatherSum.generateTrial(b.skill.id, b.params, 9)
    const scaffolded = gatherSum.applyScaffold(spec, 1)
    expect(scaffolded.data.choices).toHaveLength(2)
    expect(scaffolded.data.choices).toContain(spec.data.answer)
  })

  it('combine-count sums stay within maxSum and choices include the sum', () => {
    for (const b of bindingsFor('combine-count')) {
      const maxSum = b.params['maxSum'] as number
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = combineCount.generateTrial(b.skill.id, b.params, seed)
        const { a, b: bb, answer, choices } = spec.data
        expect(a + bb).toBe(answer)
        expect(answer).toBeLessThanOrEqual(maxSum)
        expect(a).toBeGreaterThanOrEqual(1)
        expect(bb).toBeGreaterThanOrEqual(1)
        expect(choices).toContain(answer)
        expect(new Set(choices).size).toBe(choices.length)
      }
    }
  })

  it('take-away never goes to zero or negative and choices include the rest', () => {
    for (const b of bindingsFor('take-away')) {
      const maxStart = b.params['maxStart'] as number
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = takeAway.generateTrial(b.skill.id, b.params, seed)
        const { start, take, answer, choices } = spec.data
        expect(start - take).toBe(answer)
        expect(start).toBeLessThanOrEqual(maxStart)
        expect(answer).toBeGreaterThanOrEqual(1)
        expect(take).toBeGreaterThanOrEqual(1)
        expect(choices).toContain(answer)
      }
    }
  })

  it('equation results stay within bounds for both operators and missing mode', () => {
    for (const b of bindingsFor('equation')) {
      const max = b.params['max'] as number
      const op = b.params['op'] as string
      const missing = b.params['missing'] === true
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = equation.generateTrial(b.skill.id, b.params, seed)
        const { a, b: bb, answer, choices } = spec.data
        if (missing) {
          expect(a + answer).toBe(bb) // a + ? = b
          expect(bb).toBeLessThanOrEqual(max)
          expect(answer).toBeGreaterThanOrEqual(1)
        } else {
          expect(op === 'plus' ? a + bb : a - bb).toBe(answer)
          expect(answer).toBeGreaterThanOrEqual(op === 'plus' ? 2 : 1)
          expect(answer).toBeLessThanOrEqual(max)
        }
        expect(choices).toContain(answer)
        const scaffolded = equation.applyScaffold(spec, 1)
        expect(scaffolded.data.showPiles).toBe(true)
      }
    }
  })

  it('doubles mode produces two equal piles', () => {
    const b = bindingsFor('combine-count').find((x) => x.params['doubles'] === true)!
    for (let seed = 1; seed <= SEEDS; seed++) {
      const spec = combineCount.generateTrial(b.skill.id, b.params, seed)
      expect(spec.data.a).toBe(spec.data.b)
      expect(spec.data.answer).toBeLessThanOrEqual(b.params['maxSum'] as number)
    }
  })
})
