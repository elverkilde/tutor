import { describe, expect, it } from 'vitest'
import skillsJson from '../data/skills.json'
import type { MasteryState, Skill, Trial } from '../engine/types'
import { masteredState } from '../engine/testHelpers'
import { layoutSkillMap, NODE_H, NODE_W } from './mapLayout'
import { sessionSeries } from './trendData'
import { buildSuggestions } from './suggestions'

const skills = skillsJson as Skill[]

describe('layoutSkillMap', () => {
  const layout = layoutSkillMap(skills, {})

  it('places every skill exactly once with no overlapping nodes', () => {
    expect(layout.nodes).toHaveLength(skills.length)
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a.id === b.id) continue
        const apart = Math.abs(a.x - b.x) >= NODE_W || Math.abs(a.y - b.y) >= NODE_H
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true)
      }
    }
  })

  it('has one edge per prerequisite, all inside the canvas', () => {
    const prereqCount = skills.reduce((n, s) => n + s.prereqs.length, 0)
    expect(layout.edges).toHaveLength(prereqCount)
    for (const n of layout.nodes) {
      expect(n.x + NODE_W).toBeLessThanOrEqual(layout.width)
      expect(n.y + NODE_H).toBeLessThanOrEqual(layout.height)
    }
  })

  it('statuses reflect mastery', () => {
    const withMastery = layoutSkillMap(skills, { 'subitize-1-3': masteredState('subitize-1-3') })
    const byId = new Map(withMastery.nodes.map((n) => [n.id, n]))
    expect(byId.get('subitize-1-3')!.status).toBe('mastered')
    expect(byId.get('count-1-5')!.status).toBe('frontier')
    expect(byId.get('count-1-10')!.status).toBe('locked')
  })
})

function trial(overrides: Partial<Trial>): Trial {
  return {
    id: Math.random().toString(36).slice(2),
    sessionId: 's1',
    ts: '2026-08-14T13:30:00Z',
    mode: 'practice',
    skillId: 'count-1-5',
    templateId: 'drag-to-chest',
    params: {},
    scaffoldLevel: 0,
    outcome: 'correct',
    responseMs: 2000,
    ...overrides,
  }
}

describe('sessionSeries', () => {
  it('computes first-try rates per domain and ignores scaffolded retries', () => {
    const trials: Trial[] = [
      trial({ outcome: 'correct', responseMs: 1000 }),
      trial({ outcome: 'incorrect', responseMs: 3000 }),
      trial({ scaffoldLevel: 1, outcome: 'correct' }), // retry — excluded
      trial({ skillId: 'pattern-ab', templateId: 'pattern-continue', outcome: 'correct', responseMs: 5000 }),
    ]
    const [point] = sessionSeries(trials, skills)
    expect(point.byDomain.counting).toEqual({ clean: 1, total: 2 })
    expect(point.byDomain.patterns).toEqual({ clean: 1, total: 1 })
    expect(point.overall).toEqual({ clean: 2, total: 3 })
    expect(point.medianMs).toBe(3000) // median of 1000 and 5000
  })

  it('orders sessions chronologically', () => {
    const trials = [
      trial({ sessionId: 'later', ts: '2026-08-15T10:00:00Z' }),
      trial({ sessionId: 'earlier', ts: '2026-08-14T10:00:00Z' }),
    ]
    expect(sessionSeries(trials, skills).map((p) => p.sessionId)).toEqual(['earlier', 'later'])
  })
})

describe('buildSuggestions', () => {
  const now = '2026-08-20T12:00:00Z'

  function windowOf(entries: [('correct' | 'incorrect' | 'demonstrated'), number][]): MasteryState {
    return {
      skillId: 'x',
      window: entries.map(([outcome, scaffoldLevel], i) => ({
        outcome,
        scaffoldLevel: scaffoldLevel as 0 | 1 | 2,
        ts: `2026-08-14T13:0${i}:00Z`,
      })),
    }
  }

  it('reports active placement', () => {
    const suggestions = buildSuggestions(skills, {}, {
      domainQueue: [], currentDomain: 'counting', ladderIndex: 0,
      lastWasPass: null, probesUsed: 10, provisionalMastered: [], done: false,
    }, now)
    expect(suggestions.some((s) => s.kind === 'placement' && s.text.includes('10/24'))).toBe(true)
  })

  it('flags close-to-mastery and struggling skills', () => {
    const mastery = {
      'subitize-1-3': masteredState('subitize-1-3'),
      // close: 5/6 clean in window
      'count-1-5': { ...windowOf([['correct', 0], ['correct', 0], ['correct', 0], ['correct', 0], ['incorrect', 0], ['correct', 0]]), skillId: 'count-1-5' },
      // struggling: two demonstrations
      'compare-1-5': { ...windowOf([['incorrect', 0], ['demonstrated', 2], ['incorrect', 0], ['demonstrated', 2]]), skillId: 'compare-1-5' },
    }
    const suggestions = buildSuggestions(skills, mastery, null, now)
    expect(suggestions.find((s) => s.kind === 'close')?.text).toContain('Tæl og hent 1-5')
    expect(suggestions.find((s) => s.kind === 'support')?.text).toContain('Flest blokke 1-5')
    expect(suggestions.some((s) => s.kind === 'ready')).toBe(true) // untouched frontier skills exist
  })

  it('flags stale reviews after 5 days', () => {
    const old = masteredState('subitize-1-3') // masteredAt 2026-01-01 — long ago
    const suggestions = buildSuggestions(skills, { 'subitize-1-3': old }, null, now)
    expect(suggestions.find((s) => s.kind === 'review')?.text).toContain('Se antal 1-3')
  })

  it('is quiet when everything is balanced', () => {
    const suggestions = buildSuggestions(skills, {}, null, now)
    // Fresh profile: only "newly reachable" roots — no support/close/review noise.
    expect(suggestions.map((s) => s.kind)).toEqual(['ready'])
  })
})
