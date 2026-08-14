import type { Domain, Skill, Trial } from '../engine/types'

/**
 * Per-session series for the trends charts. "First-try success" counts only
 * scaffold-level-0 presentations — the honest measure of independent
 * ability. Pure functions, unit-tested.
 */

export interface DomainStat {
  clean: number
  total: number
}

export interface SessionPoint {
  sessionId: string
  start: string
  byDomain: Partial<Record<Domain, DomainStat>>
  overall: DomainStat
  /** median response time (ms) of clean correct answers; null if none */
  medianMs: number | null
}

export function sessionSeries(trials: Trial[], skills: Skill[]): SessionPoint[] {
  const domainOf = new Map(skills.map((s) => [s.id, s.domain]))
  const bySession = new Map<string, Trial[]>()
  for (const t of trials) {
    bySession.set(t.sessionId, [...(bySession.get(t.sessionId) ?? []), t])
  }

  const points: SessionPoint[] = []
  for (const [sessionId, ts] of bySession) {
    const firstTries = ts.filter((t) => t.scaffoldLevel === 0)
    const byDomain: Partial<Record<Domain, DomainStat>> = {}
    for (const t of firstTries) {
      const d = domainOf.get(t.skillId)
      if (!d) continue
      const stat = (byDomain[d] ??= { clean: 0, total: 0 })
      stat.total++
      if (t.outcome === 'correct') stat.clean++
    }
    const cleanTimes = firstTries
      .filter((t) => t.outcome === 'correct' && t.responseMs > 0)
      .map((t) => t.responseMs)
      .sort((a, b) => a - b)
    points.push({
      sessionId,
      start: ts.reduce((min, t) => (t.ts < min ? t.ts : min), ts[0].ts),
      byDomain,
      overall: {
        clean: firstTries.filter((t) => t.outcome === 'correct').length,
        total: firstTries.length,
      },
      medianMs:
        cleanTimes.length === 0
          ? null
          : cleanTimes.length % 2 === 1
            ? cleanTimes[(cleanTimes.length - 1) / 2]
            : Math.round((cleanTimes[cleanTimes.length / 2 - 1] + cleanTimes[cleanTimes.length / 2]) / 2),
    })
  }
  return points.sort((a, b) => a.start.localeCompare(b.start))
}
