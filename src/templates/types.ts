import type { FunctionComponent } from 'preact'
import type { PhraseRef } from '../data/phrases'
import type { ScaffoldLevel, TemplateParams } from '../engine/types'

/**
 * A trial fully described as data. generateTrial is pure and seeded, so the
 * same seed re-presents the exact same quantities when we scaffold a retry —
 * the task gets easier, the numbers don't change under the child.
 */
export interface TrialSpec<D = unknown> {
  templateId: string
  skillId: string
  params: TemplateParams
  seed: number
  promptPhrase: PhraseRef
  data: D
}

export interface TemplateProps<D = unknown> {
  spec: TrialSpec<D>
  /** 0 = clean, 1 = retry with visual scaffold, 2 = demonstrate the answer */
  scaffoldLevel: ScaffoldLevel
  stimulation: 'calm' | 'normal'
  speak: (ref: PhraseRef) => Promise<void>
  /** The one and only way a template reports back. No sequencing logic inside templates. */
  onResponse: (r: { correct: boolean }) => void
  /** Called when a level-2 demonstration finishes playing. */
  onDemoFinished: () => void
}

export interface TaskTemplate<D = unknown> {
  id: string
  generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<D>
  /** Pure: returns a (possibly) simplified spec for the given scaffold level. */
  applyScaffold(spec: TrialSpec<D>, level: ScaffoldLevel): TrialSpec<D>
  View: FunctionComponent<TemplateProps<D>>
}

export function rangeOf(params: TemplateParams): [number, number] {
  const r = params['range']
  if (Array.isArray(r) && r.length === 2) return [r[0], r[1]]
  return [1, 5]
}
