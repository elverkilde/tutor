import { describe, expect, it } from 'vitest'
import skillsJson from '../data/skills.json'
import {
  applyProbeResult,
  domainLadder,
  initPlacement,
  nextProbe,
  PROBE_CAP,
  seedMastery,
  skillDepth,
} from './placement'
import { mulberry32 } from './rng'
import { makeSkill, masteredState } from './testHelpers'
import type { PlacementState, Skill } from './types'

const skills = skillsJson as Skill[]
const byId = new Map(skills.map((s) => [s.id, s]))

/** Runs placement to completion with a learner who passes iff depth <= ability. */
function runPlacement(world: Skill[], passes: (skillId: string) => boolean) {
  const worldById = new Map(world.map((s) => [s.id, s]))
  let p = initPlacement(world)
  let guard = 0
  while (!p.done) {
    const probe = nextProbe(p, world)
    expect(probe).not.toBeNull()
    p = applyProbeResult(p, world, passes(probe!.skillId))
    expect(++guard).toBeLessThanOrEqual(PROBE_CAP)
  }
  return { placement: p, depthOf: (id: string) => skillDepth(worldById.get(id)!, worldById) }
}

const abilityLearner = (ability: number) => (skillId: string) =>
  skillDepth(byId.get(skillId)!, byId) <= ability

describe('placement on the real curriculum', () => {
  it('a perfect learner masters a broad set within the probe cap', () => {
    const { placement } = runPlacement(skills, () => true)
    // 30 skills can't all be probed in one placement — but the early domains
    // should be covered deep, and both roots must be in.
    expect(placement.provisionalMastered.length).toBeGreaterThanOrEqual(10)
    expect(placement.provisionalMastered).toContain('subitize-1-3')
    expect(placement.provisionalMastered).toContain('pattern-ab')
    expect(placement.probesUsed).toBeLessThanOrEqual(PROBE_CAP)
  })

  it('a struggling learner ends with only the two entry skills mastered', () => {
    const { placement } = runPlacement(skills, abilityLearner(0))
    expect(placement.provisionalMastered.sort()).toEqual(['pattern-ab', 'subitize-1-3'])
  })

  it('is conservative: never masters a skill above the learner ability', () => {
    for (const ability of [0, 1, 2, 3]) {
      const { placement, depthOf } = runPlacement(skills, abilityLearner(ability))
      for (const id of placement.provisionalMastered) {
        expect(depthOf(id)).toBeLessThanOrEqual(ability)
      }
    }
  })

  it('an ability-1 learner masters depth<=1 skills across the early domains', () => {
    const { placement } = runPlacement(skills, abilityLearner(1))
    // compare-1-5 is the breadth canary: with magnitude at the back of the
    // queue the probe cap starved it, so comparison never got assessed.
    for (const id of ['subitize-1-3', 'subitize-compare-1-4', 'pattern-ab', 'compare-1-5', 'count-1-5']) {
      expect(placement.provisionalMastered).toContain(id)
    }
    for (const id of placement.provisionalMastered) {
      expect(skillDepth(byId.get(id)!, byId)).toBeLessThanOrEqual(1)
    }
  })

  it('always terminates for erratic learners (50 random seeds)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed)
      const { placement } = runPlacement(skills, () => rng.next() < 0.6)
      expect(placement.done).toBe(true)
      expect(placement.probesUsed).toBeLessThanOrEqual(PROBE_CAP)
    }
  })
})

describe('placement on a deep single-domain ladder', () => {
  // c0 <- c1 <- ... <- c4, all in one domain
  const chain: Skill[] = Array.from({ length: 5 }, (_, i) =>
    makeSkill({ id: `c${i}`, prereqs: i === 0 ? [] : [`c${i - 1}`] }),
  )
  const chainById = new Map(chain.map((s) => [s.id, s]))

  it('finds the frontier of a mid-ability learner via jumps and step-downs', () => {
    const { placement } = runPlacement(chain, (id) => skillDepth(chainById.get(id)!, chainById) <= 2)
    expect(placement.provisionalMastered.sort()).toEqual(['c0', 'c1', 'c2'])
  })

  it('orders the ladder by prerequisite depth', () => {
    expect(domainLadder(chain, 'counting').map((s) => s.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4'])
  })
})

describe('seedMastery', () => {
  it('marks provisional skills mastered without touching existing mastery', () => {
    const placement: PlacementState = {
      ...initPlacement(skills),
      provisionalMastered: ['subitize-1-3', 'count-1-5'],
      done: true,
    }
    const existing = { 'subitize-1-3': masteredState('subitize-1-3') }
    const seeded = seedMastery(existing, placement, '2026-08-14T12:00:00Z')
    expect(seeded['subitize-1-3'].masteredAt).toBe('2026-01-01T00:07:00Z') // unchanged
    expect(seeded['count-1-5'].masteredAt).toBe('2026-08-14T12:00:00Z')
  })
})
