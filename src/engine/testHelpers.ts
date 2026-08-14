import type { MasteryState, Skill, WindowEntry } from './types'
import { WINDOW_SIZE } from './types'

export function masteredState(skillId: string): MasteryState {
  const window: WindowEntry[] = Array.from({ length: WINDOW_SIZE }, (_, i) => ({
    outcome: 'correct',
    scaffoldLevel: 0,
    ts: `2026-01-01T00:0${i}:00Z`,
  }))
  return { skillId, window, masteredAt: '2026-01-01T00:07:00Z' }
}

export function makeSkill(overrides: Partial<Skill> & Pick<Skill, 'id'>): Skill {
  return {
    domain: 'counting',
    titleDa: overrides.id,
    cra: 'concrete',
    prereqs: [],
    review: true,
    templates: [{ templateId: 'drag-to-chest', params: { range: [1, 5] } }],
    ...overrides,
  }
}
