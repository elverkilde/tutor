import { deriveStatus, isMastered } from '../engine/mastery'
import { PROBE_CAP } from '../engine/placement'
import type { MasteryState, PlacementState, Skill } from '../engine/types'

/**
 * Turns the mastery map into a short list of things worth the adult's
 * attention. Pure and unit-tested; wording stays adult-facing English.
 */

export type SuggestionKind = 'placement' | 'close' | 'support' | 'ready' | 'review'

export interface Suggestion {
  kind: SuggestionKind
  text: string
}

const REVIEW_STALE_DAYS = 5

function cleanRate(state: MasteryState): number {
  if (state.window.length === 0) return 0
  return state.window.filter((e) => e.outcome === 'correct' && e.scaffoldLevel === 0).length / state.window.length
}

function names(skills: Skill[], max = 3): string {
  const shown = skills.slice(0, max).map((s) => `“${s.titleDa}”`)
  const extra = skills.length - shown.length
  return shown.join(', ') + (extra > 0 ? ` (+${extra} more)` : '')
}

export function buildSuggestions(
  skills: Skill[],
  mastery: Record<string, MasteryState>,
  placement: PlacementState | null | undefined,
  now: string,
): Suggestion[] {
  const out: Suggestion[] = []

  if (placement && !placement.done) {
    out.push({
      kind: 'placement',
      text: `Placement is still running (${placement.probesUsed}/${PROBE_CAP} probes, currently ${placement.currentDomain}) — item choice is automatic until it converges.`,
    })
  }

  const unlocked = skills.filter((s) => deriveStatus(s, mastery) === 'practicing')

  const close = unlocked.filter((s) => {
    const st = mastery[s.id]
    return st && st.window.length >= 6 && cleanRate(st) >= 0.7
  })
  if (close.length > 0) {
    out.push({ kind: 'close', text: `Close to mastery: ${names(close)} — a good session could tip ${close.length === 1 ? 'it' : 'them'} over.` })
  }

  const struggling = unlocked.filter((s) => {
    const st = mastery[s.id]
    if (!st || st.window.length < 4) return false
    const demos = st.window.filter((e) => e.outcome === 'demonstrated').length
    return demos >= 2 || cleanRate(st) <= 0.4
  })
  if (struggling.length > 0) {
    out.push({
      kind: 'support',
      text: `Needs support: ${names(struggling)} — worth doing together off-screen (real blocks on the table) before more app rounds.`,
    })
  }

  const fresh = skills.filter((s) => deriveStatus(s, mastery) === 'frontier')
  if (fresh.length > 0) {
    out.push({ kind: 'ready', text: `Newly reachable: ${names(fresh)} — the selector will introduce ${fresh.length === 1 ? 'it' : 'these'} soon.` })
  }

  const nowMs = Date.parse(now)
  const stale = skills.filter((s) => {
    const st = mastery[s.id]
    if (!s.review || !isMastered(st)) return false
    const last = st!.lastReviewedAt ?? st!.masteredAt
    if (!last) return false
    return nowMs - Date.parse(last) > REVIEW_STALE_DAYS * 24 * 3600 * 1000
  })
  if (stale.length > 0) {
    out.push({ kind: 'review', text: `Due for review: ${names(stale)} — retention needs the occasional revisit.` })
  }

  return out
}
