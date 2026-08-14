import { deriveStatus } from '../engine/mastery'
import { DOMAIN_ORDER, skillDepth } from '../engine/placement'
import type { MasteryState, MasteryStatus, Skill } from '../engine/types'

/**
 * Layout for the skill map: each domain is a horizontal track (row), each
 * prerequisite depth a column — so progress reads left-to-right per track
 * and the mastered/frontier boundary is visible at a glance. Pure function,
 * no DOM.
 */

export const NODE_W = 132
export const NODE_H = 54
export const COL_W = 158
export const ROW_H = 148
const PAD = 16
const STACK_GAP = 10

export interface MapNode {
  id: string
  title: string
  status: MasteryStatus
  x: number
  y: number
}

export interface MapEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface MapLayout {
  nodes: MapNode[]
  edges: MapEdge[]
  width: number
  height: number
}

export function layoutSkillMap(
  skills: Skill[],
  mastery: Record<string, MasteryState>,
): MapLayout {
  const byId = new Map(skills.map((s) => [s.id, s]))
  const domains = DOMAIN_ORDER.filter((d) => skills.some((s) => s.domain === d))

  const pos = new Map<string, { x: number; y: number }>()
  const nodes: MapNode[] = []
  let maxDepth = 0

  for (const [row, domain] of domains.entries()) {
    // Group this domain's skills by depth so same-depth skills stack.
    const stacks = new Map<number, Skill[]>()
    for (const s of skills.filter((k) => k.domain === domain)) {
      const d = skillDepth(s, byId)
      maxDepth = Math.max(maxDepth, d)
      stacks.set(d, [...(stacks.get(d) ?? []), s])
    }
    for (const [depth, group] of stacks) {
      group.sort((a, b) => a.id.localeCompare(b.id))
      for (const [i, s] of group.entries()) {
        const x = PAD + depth * COL_W
        const y = PAD + row * ROW_H + i * (NODE_H + STACK_GAP)
        pos.set(s.id, { x, y })
        nodes.push({ id: s.id, title: s.titleDa, status: deriveStatus(s, mastery), x, y })
      }
    }
  }

  const edges: MapEdge[] = []
  for (const s of skills) {
    const to = pos.get(s.id)!
    for (const p of s.prereqs) {
      const from = pos.get(p)!
      edges.push({
        x1: from.x + NODE_W,
        y1: from.y + NODE_H / 2,
        x2: to.x,
        y2: to.y + NODE_H / 2,
      })
    }
  }

  return {
    nodes,
    edges,
    width: PAD * 2 + (maxDepth + 1) * COL_W,
    height: PAD * 2 + domains.length * ROW_H,
  }
}
