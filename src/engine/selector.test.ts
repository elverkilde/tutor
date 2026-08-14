import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { selectNext } from './selector'
import { makeSkill, masteredState } from './testHelpers'
import { defaultSettings } from './types'

const settings = defaultSettings()

// A small world: one mastered root, two frontier children, one locked grandchild.
const world = [
  makeSkill({ id: 'root', review: true }),
  makeSkill({ id: 'kid-a', prereqs: ['root'] }),
  makeSkill({ id: 'kid-b', prereqs: ['root'], domain: 'magnitude' }),
  makeSkill({ id: 'grandkid', prereqs: ['kid-a'] }),
]
const worldMastery = { root: masteredState('root') }

describe('selectNext', () => {
  it('splits roughly 80/20 between frontier and review over 1000 draws', () => {
    const rng = mulberry32(42)
    let review = 0
    for (let i = 0; i < 1000; i++) {
      const pick = selectNext(world, worldMastery, settings, [], rng)!
      if (pick.skillId === 'root') review++
    }
    expect(review).toBeGreaterThan(150)
    expect(review).toBeLessThan(250)
  })

  it('never selects locked skills', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const pick = selectNext(world, worldMastery, settings, [], rng)!
      expect(pick.skillId).not.toBe('grandkid')
    }
  })

  it('respects the enabled-domains filter', () => {
    const rng = mulberry32(11)
    const only = { ...settings, domainsEnabled: ['magnitude' as const] }
    for (let i = 0; i < 200; i++) {
      const pick = selectNext(world, worldMastery, only, [], rng)
      expect(pick?.skillId).toBe('kid-b')
    }
  })

  it('returns null when nothing is available', () => {
    const rng = mulberry32(3)
    const none = { ...settings, domainsEnabled: [] }
    expect(selectNext(world, worldMastery, none, [], rng)).toBeNull()
  })

  it('avoids repeating the previous template when an alternative exists', () => {
    const rng = mulberry32(5)
    const twoTemplates = [
      makeSkill({
        id: 'multi',
        templates: [
          { templateId: 'drag-to-chest', params: {} },
          { templateId: 'numeral-match', params: {} },
        ],
      }),
    ]
    for (let i = 0; i < 100; i++) {
      const pick = selectNext(
        twoTemplates,
        {},
        settings,
        [{ templateId: 'drag-to-chest', skillId: 'other' }],
        rng,
      )!
      expect(pick.templateId).toBe('numeral-match')
    }
  })

  it('avoids repeating the previous skill when the pool has alternatives', () => {
    const rng = mulberry32(13)
    for (let i = 0; i < 200; i++) {
      const pick = selectNext(
        world,
        worldMastery,
        settings,
        [{ templateId: 'drag-to-chest', skillId: 'kid-a' }],
        rng,
      )!
      expect(pick.skillId).not.toBe('kid-a')
    }
  })

  it('keeps serving review skills when everything is mastered', () => {
    const rng = mulberry32(9)
    const allDone = {
      root: masteredState('root'),
      'kid-a': masteredState('kid-a'),
      'kid-b': masteredState('kid-b'),
      grandkid: masteredState('grandkid'),
    }
    const pick = selectNext(world, allDone, settings, [], rng)
    expect(pick).not.toBeNull()
  })
})
