import { describe, expect, it } from 'vitest'
import skillsJson from '../data/skills.json'
import { TEMPLATE_IDS } from '../templates/ids'
import { frontier, validateGraph } from './graph'
import { makeSkill, masteredState } from './testHelpers'
import type { Skill } from './types'

const skills = skillsJson as Skill[]
const templateIds = [...TEMPLATE_IDS]

describe('skills.json', () => {
  it('is a valid DAG with resolvable templates', () => {
    expect(() => validateGraph(skills, templateIds)).not.toThrow()
  })

  it('has at least one root skill', () => {
    expect(skills.some((s) => s.prereqs.length === 0)).toBe(true)
  })
})

describe('validateGraph', () => {
  it('rejects duplicate ids', () => {
    const dup = [makeSkill({ id: 'a' }), makeSkill({ id: 'a' })]
    expect(() => validateGraph(dup, templateIds)).toThrow(/duplicate/)
  })

  it('rejects unknown prereqs', () => {
    const bad = [makeSkill({ id: 'a', prereqs: ['ghost'] })]
    expect(() => validateGraph(bad, templateIds)).toThrow(/unknown prereq/)
  })

  it('rejects unknown templates', () => {
    const bad = [
      makeSkill({ id: 'a', templates: [{ templateId: 'nope', params: {} }] }),
    ]
    expect(() => validateGraph(bad, templateIds)).toThrow(/unknown template/)
  })

  it('rejects cycles', () => {
    const cyclic = [
      makeSkill({ id: 'a', prereqs: ['b'] }),
      makeSkill({ id: 'b', prereqs: ['a'] }),
    ]
    expect(() => validateGraph(cyclic, templateIds)).toThrow(/cycle|roots/)
  })
})

describe('frontier', () => {
  it('is only the roots when nothing is mastered', () => {
    const f = frontier(skills, {})
    expect(f.map((s) => s.id).sort()).toEqual(['pattern-ab', 'subitize-1-3'])
  })

  it('unlocks dependents when a prereq is mastered', () => {
    const mastery = { 'subitize-1-3': masteredState('subitize-1-3') }
    const ids = frontier(skills, mastery).map((s) => s.id)
    expect(ids).toContain('count-1-5')
    expect(ids).toContain('compare-1-5')
    expect(ids).toContain('numeral-match-1-5')
    expect(ids).toContain('subitize-compare-1-4')
    expect(ids).not.toContain('subitize-1-3') // mastered
    expect(ids).not.toContain('count-1-10') // still locked behind count-1-5
    expect(ids).not.toContain('add-combine-to-5') // needs count-1-5 AND numeral-match-1-5
  })
})
