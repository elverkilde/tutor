import type { MasteryState, Skill } from './types'
import { isMastered } from './mastery'

/**
 * Validates the skill graph: unique ids, resolvable prereqs, acyclic,
 * every skill reachable from a root. Throws with a descriptive message —
 * runs at app start and in tests so a bad skills.json edit fails loudly.
 */
export function validateGraph(skills: Skill[], knownTemplateIds: string[]): void {
  const ids = new Set<string>()
  for (const s of skills) {
    if (ids.has(s.id)) throw new Error(`duplicate skill id: ${s.id}`)
    ids.add(s.id)
    if (s.templates.length === 0) throw new Error(`skill ${s.id} has no templates`)
    for (const t of s.templates) {
      if (!knownTemplateIds.includes(t.templateId)) {
        throw new Error(`skill ${s.id} references unknown template: ${t.templateId}`)
      }
    }
  }
  for (const s of skills) {
    for (const p of s.prereqs) {
      if (!ids.has(p)) throw new Error(`skill ${s.id} has unknown prereq: ${p}`)
    }
  }

  // Kahn's algorithm: detects cycles.
  const indegree = new Map<string, number>(skills.map((s) => [s.id, s.prereqs.length]))
  const dependents = new Map<string, string[]>()
  for (const s of skills) {
    for (const p of s.prereqs) {
      dependents.set(p, [...(dependents.get(p) ?? []), s.id])
    }
  }
  const queue = skills.filter((s) => s.prereqs.length === 0).map((s) => s.id)
  if (queue.length === 0 && skills.length > 0) throw new Error('skill graph has no roots')
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const dep of dependents.get(id) ?? []) {
      const d = indegree.get(dep)! - 1
      indegree.set(dep, d)
      if (d === 0) queue.push(dep)
    }
  }
  if (visited !== skills.length) throw new Error('skill graph contains a cycle')
}

/** Skills whose prerequisites are all mastered but which are not themselves mastered. */
export function frontier(skills: Skill[], mastery: Record<string, MasteryState>): Skill[] {
  return skills.filter(
    (s) =>
      !isMastered(mastery[s.id]) && s.prereqs.every((p) => isMastered(mastery[p])),
  )
}
