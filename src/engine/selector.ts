import type { Rng } from './rng'
import type { MasteryState, SessionSettings, Skill, Trial, TrialPick } from './types'
import { FRONTIER_SHARE } from './types'
import { frontier } from './graph'
import { isMastered } from './mastery'

/**
 * Picks the next trial: ~80% from the frontier (prereqs mastered, skill not
 * yet mastered — the zone the child can grow in), ~20% review of mastered
 * skills (retention matters more for this learner profile than for typical
 * kids). Within the frontier, skills with the fewest attempts come first so
 * new material gets introduced steadily. Avoids repeating the template of
 * the immediately preceding trial when an alternative exists.
 */
export function selectNext(
  skills: Skill[],
  mastery: Record<string, MasteryState>,
  settings: SessionSettings,
  recent: Pick<Trial, 'templateId' | 'skillId'>[],
  rng: Rng,
): TrialPick | null {
  const enabled = skills.filter((s) => settings.domainsEnabled.includes(s.domain))

  const frontierPool = frontier(enabled, mastery)
  const reviewPool = enabled.filter((s) => s.review && isMastered(mastery[s.id]))

  const wantReview = rng.next() >= FRONTIER_SHARE
  let pool: Skill[]
  if (wantReview && reviewPool.length > 0) {
    // Oldest-reviewed first so review rotates through everything mastered.
    pool = [...reviewPool].sort((a, b) =>
      (mastery[a.id]?.lastReviewedAt ?? '').localeCompare(mastery[b.id]?.lastReviewedAt ?? ''),
    )
    pool = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)))
  } else if (frontierPool.length > 0) {
    const attempts = (s: Skill) => mastery[s.id]?.window.length ?? 0
    const fewest = Math.min(...frontierPool.map(attempts))
    pool = frontierPool.filter((s) => attempts(s) <= fewest + 2)
  } else if (reviewPool.length > 0) {
    pool = reviewPool // everything mastered: keep practicing
  } else {
    return null // nothing available (all domains disabled)
  }

  // Variety: don't serve the same skill back-to-back when there's a choice.
  const lastSkill = recent.length > 0 ? recent[recent.length - 1].skillId : null
  const varied = pool.filter((s) => s.id !== lastSkill)
  const skill = rng.pick(varied.length > 0 ? varied : pool)
  const lastTemplate = recent.length > 0 ? recent[recent.length - 1].templateId : null
  const alternatives = skill.templates.filter((t) => t.templateId !== lastTemplate)
  const binding = rng.pick(alternatives.length > 0 ? alternatives : skill.templates)

  return { skillId: skill.id, templateId: binding.templateId, params: binding.params }
}
