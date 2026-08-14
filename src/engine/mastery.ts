import type { MasteryState, MasteryStatus, Skill, Trial, WindowEntry } from './types'
import { MASTERY_THRESHOLD, WINDOW_SIZE } from './types'

export function emptyMastery(skillId: string): MasteryState {
  return { skillId, window: [] }
}

/**
 * Mastered when the window is full and >=85% of entries are clean correct
 * answers (no scaffold). Scaffolded successes build confidence but don't
 * count toward mastery. Once masteredAt is set it sticks — regression shows
 * up in review accuracy on the dashboard instead of re-locking skills,
 * which would silently shrink the child's world.
 */
export function isMastered(state: MasteryState | undefined): boolean {
  if (!state) return false
  if (state.masteredAt) return true
  if (state.window.length < WINDOW_SIZE) return false
  const clean = state.window.filter((e) => e.outcome === 'correct' && e.scaffoldLevel === 0)
  return clean.length / state.window.length >= MASTERY_THRESHOLD
}

export function appendToWindow(state: MasteryState, entry: WindowEntry): MasteryState {
  const window = [...state.window, entry].slice(-WINDOW_SIZE)
  const next: MasteryState = { ...state, window }
  if (!next.masteredAt && isMastered(next)) next.masteredAt = entry.ts
  return next
}

/** The single write path: fold one trial into the mastery map. */
export function applyTrial(
  mastery: Record<string, MasteryState>,
  trial: Trial,
): Record<string, MasteryState> {
  const prev = mastery[trial.skillId] ?? emptyMastery(trial.skillId)
  let next = appendToWindow(prev, {
    outcome: trial.outcome,
    scaffoldLevel: trial.scaffoldLevel,
    ts: trial.ts,
  })
  if (prev.masteredAt) next = { ...next, lastReviewedAt: trial.ts }
  return { ...mastery, [trial.skillId]: next }
}

export function deriveStatus(
  skill: Skill,
  mastery: Record<string, MasteryState>,
): MasteryStatus {
  const state = mastery[skill.id]
  if (isMastered(state)) return 'mastered'
  if (!skill.prereqs.every((p) => isMastered(mastery[p]))) return 'locked'
  return state && state.window.length > 0 ? 'practicing' : 'frontier'
}
