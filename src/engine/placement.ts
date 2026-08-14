import type { Domain, MasteryState, PlacementState, Skill, TrialPick } from './types'

/**
 * Placement: the first sessions quietly discover what the child can do.
 * Per domain, an adaptive staircase walks a difficulty ladder (skills sorted
 * by prerequisite depth). The child's experience is identical to normal play;
 * only the item choice differs. The verdict for each probe is the FIRST,
 * unscaffolded attempt.
 *
 * Rules per rung: two consecutive clean passes -> rung provisionally
 * mastered, jump up two rungs. A fail directly after a pass -> converge
 * (this rung is his frontier). A fail on a fresh rung -> one retry; a second
 * fail -> step down (skipping already-mastered rungs). Placement is
 * deliberately conservative: it only marks mastered what was actually
 * passed twice — under-placing costs a little practice time, over-placing
 * costs frustration.
 */
export const PROBE_CAP = 24

// Patterns early: often a relative strength for autistic children — early
// wins during placement buy engagement for the harder domains after.
// Magnitude right behind: perceptual comparison needs no counting, and at
// its old back-of-queue spot the probe cap regularly starved it entirely.
export const DOMAIN_ORDER: Domain[] = [
  'subitizing',
  'patterns',
  'magnitude',
  'counting',
  'numeral',
  'ordering',
  'addsub',
]

/** Longest prerequisite chain below a skill — its "depth" in the graph. */
export function skillDepth(skill: Skill, byId: Map<string, Skill>): number {
  if (skill.prereqs.length === 0) return 0
  return 1 + Math.max(...skill.prereqs.map((p) => skillDepth(byId.get(p)!, byId)))
}

/** The difficulty ladder for one domain: shallowest first, ties by id. */
export function domainLadder(skills: Skill[], domain: Domain): Skill[] {
  const byId = new Map(skills.map((s) => [s.id, s]))
  return skills
    .filter((s) => s.domain === domain)
    .sort((a, b) => skillDepth(a, byId) - skillDepth(b, byId) || a.id.localeCompare(b.id))
}

export function initPlacement(skills: Skill[]): PlacementState {
  const domains = DOMAIN_ORDER.filter((d) => skills.some((s) => s.domain === d))
  return {
    domainQueue: domains.slice(1),
    currentDomain: domains[0],
    ladderIndex: 0,
    lastWasPass: null,
    probesUsed: 0,
    provisionalMastered: [],
    done: domains.length === 0,
  }
}

export function nextProbe(placement: PlacementState, skills: Skill[]): TrialPick | null {
  if (placement.done) return null
  const ladder = domainLadder(skills, placement.currentDomain)
  const skill = ladder[placement.ladderIndex]
  if (!skill) return null
  const binding = skill.templates[0]
  return { skillId: skill.id, templateId: binding.templateId, params: binding.params }
}

function advanceDomain(p: PlacementState): PlacementState {
  if (p.domainQueue.length === 0) return { ...p, done: true }
  return {
    ...p,
    currentDomain: p.domainQueue[0],
    domainQueue: p.domainQueue.slice(1),
    ladderIndex: 0,
    lastWasPass: null,
  }
}

export function applyProbeResult(
  placement: PlacementState,
  skills: Skill[],
  pass: boolean,
): PlacementState {
  if (placement.done) return placement
  const ladder = domainLadder(skills, placement.currentDomain)
  let p: PlacementState = { ...placement, probesUsed: placement.probesUsed + 1 }
  const mastered = new Set(p.provisionalMastered)
  const current = ladder[p.ladderIndex]

  if (pass) {
    if (p.lastWasPass === true) {
      // Two clean passes: rung mastered. Jump toward +2, landing on the
      // nearest unmastered rung (so short ladders still probe their top).
      mastered.add(current.id)
      let next = -1
      for (let i = p.ladderIndex + 2; i < ladder.length; i++) {
        if (!mastered.has(ladder[i].id)) {
          next = i
          break
        }
      }
      if (next === -1) {
        for (let i = ladder.length - 1; i > p.ladderIndex; i--) {
          if (!mastered.has(ladder[i].id)) {
            next = i
            break
          }
        }
      }
      p = { ...p, provisionalMastered: [...mastered], lastWasPass: null }
      p = next === -1 ? advanceDomain(p) : { ...p, ladderIndex: next }
    } else {
      p = { ...p, lastWasPass: true }
    }
  } else if (p.lastWasPass === true) {
    // Pass-then-fail: this rung is the frontier. Done with the domain.
    p = advanceDomain({ ...p, lastWasPass: null })
  } else if (p.lastWasPass === null) {
    // First miss on a fresh rung could be a mistap — one retry.
    p = { ...p, lastWasPass: false }
  } else {
    // Two misses: step down past anything already mastered.
    let idx = p.ladderIndex - 1
    while (idx >= 0 && mastered.has(ladder[idx].id)) idx--
    p =
      idx < 0
        ? advanceDomain({ ...p, lastWasPass: null })
        : { ...p, ladderIndex: idx, lastWasPass: null }
  }

  if (p.probesUsed >= PROBE_CAP) p = { ...p, done: true }
  return p
}

/**
 * The mastery map as the dashboard should read it: during an active
 * placement, provisionally mastered rungs count as mastered (they were
 * passed twice — the seeding at finalize is a formality).
 */
export function effectiveMastery(
  mastery: Record<string, MasteryState>,
  placement: PlacementState | null | undefined,
  now: string,
): Record<string, MasteryState> {
  if (!placement || placement.done) return mastery
  return seedMastery(mastery, placement, now)
}

/** Fold provisional masteries into the mastery map (never downgrades). */
export function seedMastery(
  mastery: Record<string, MasteryState>,
  placement: PlacementState,
  now: string,
): Record<string, MasteryState> {
  const out = { ...mastery }
  for (const skillId of placement.provisionalMastered) {
    const existing = out[skillId] ?? { skillId, window: [] }
    if (!existing.masteredAt) out[skillId] = { ...existing, masteredAt: now }
  }
  return out
}
