import { describe, expect, it } from 'vitest'
import { appendToWindow, applyTrial, deriveStatus, emptyMastery, isMastered } from './mastery'
import { makeSkill, masteredState } from './testHelpers'
import type { Outcome, ScaffoldLevel, Trial, WindowEntry } from './types'
import { WINDOW_SIZE } from './types'

function entry(outcome: Outcome, scaffoldLevel: ScaffoldLevel = 0, i = 0): WindowEntry {
  return { outcome, scaffoldLevel, ts: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` }
}

function buildState(entries: WindowEntry[]) {
  return entries.reduce(appendToWindow, emptyMastery('s'))
}

function trial(overrides: Partial<Trial>): Trial {
  return {
    id: 't1',
    sessionId: 'sess',
    ts: '2026-01-02T00:00:00Z',
    mode: 'practice',
    skillId: 's',
    templateId: 'drag-to-chest',
    params: {},
    scaffoldLevel: 0,
    outcome: 'correct',
    responseMs: 1000,
    ...overrides,
  }
}

describe('appendToWindow', () => {
  it('keeps only the last WINDOW_SIZE entries', () => {
    const state = buildState(Array.from({ length: 12 }, (_, i) => entry('correct', 0, i)))
    expect(state.window).toHaveLength(WINDOW_SIZE)
    expect(state.window[WINDOW_SIZE - 1].ts).toContain(':11')
  })
})

describe('isMastered', () => {
  it('is false before the window fills, even with perfect answers', () => {
    const state = buildState(Array.from({ length: WINDOW_SIZE - 1 }, () => entry('correct')))
    expect(isMastered(state)).toBe(false)
  })

  it('is true at 7/8 clean correct (87.5% >= 85%)', () => {
    const state = buildState([
      entry('incorrect'),
      ...Array.from({ length: 7 }, () => entry('correct')),
    ])
    expect(isMastered(state)).toBe(true)
  })

  it('is false at 6/8 clean correct', () => {
    const state = buildState([
      entry('incorrect'),
      entry('incorrect'),
      ...Array.from({ length: 6 }, () => entry('correct')),
    ])
    expect(isMastered(state)).toBe(false)
  })

  it('does not count scaffolded successes toward mastery', () => {
    const state = buildState([
      entry('correct', 1),
      entry('correct', 1),
      ...Array.from({ length: 6 }, () => entry('correct', 0)),
    ])
    expect(isMastered(state)).toBe(false)
  })

  it('sticks once mastered, even after later misses', () => {
    let state = buildState(Array.from({ length: WINDOW_SIZE }, () => entry('correct')))
    expect(state.masteredAt).toBeTruthy()
    for (let i = 0; i < WINDOW_SIZE; i++) state = appendToWindow(state, entry('incorrect'))
    expect(isMastered(state)).toBe(true)
  })
})

describe('applyTrial', () => {
  it('creates state for a first-ever trial', () => {
    const mastery = applyTrial({}, trial({}))
    expect(mastery['s'].window).toHaveLength(1)
  })

  it('stamps lastReviewedAt when the skill was already mastered', () => {
    const mastery = applyTrial({ s: masteredState('s') }, trial({}))
    expect(mastery['s'].lastReviewedAt).toBe('2026-01-02T00:00:00Z')
  })
})

describe('deriveStatus', () => {
  const root = makeSkill({ id: 'root' })
  const child = makeSkill({ id: 'child', prereqs: ['root'] })

  it('locked while prereqs are unmastered', () => {
    expect(deriveStatus(child, {})).toBe('locked')
  })

  it('frontier when unlocked with no attempts', () => {
    expect(deriveStatus(child, { root: masteredState('root') })).toBe('frontier')
  })

  it('practicing after attempts, mastered when window qualifies', () => {
    const some = { root: masteredState('root'), child: buildState([entry('correct')]) }
    expect(deriveStatus(child, some)).toBe('practicing')
    expect(deriveStatus(root, { root: masteredState('root') })).toBe('mastered')
  })
})
