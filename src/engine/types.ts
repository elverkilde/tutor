export type Domain =
  | 'subitizing'
  | 'counting'
  | 'numeral'
  | 'magnitude'
  | 'ordering'
  | 'addsub'
  | 'patterns'

export type CraStage = 'concrete' | 'representational' | 'abstract'

export type TemplateParams = Record<string, number | string | boolean | number[]>

export interface TemplateBinding {
  templateId: string
  params: TemplateParams
}

export interface Skill {
  id: string
  domain: Domain
  titleDa: string
  cra: CraStage
  prereqs: string[]
  templates: TemplateBinding[]
  review: boolean
}

export type Outcome = 'correct' | 'incorrect' | 'demonstrated'
export type ScaffoldLevel = 0 | 1 | 2
export type Mode = 'placement' | 'practice'

export interface Trial {
  id: string
  sessionId: string
  ts: string
  mode: Mode
  skillId: string
  templateId: string
  params: TemplateParams
  scaffoldLevel: ScaffoldLevel
  outcome: Outcome
  responseMs: number
}

export interface WindowEntry {
  outcome: Outcome
  scaffoldLevel: ScaffoldLevel
  ts: string
}

export type MasteryStatus = 'locked' | 'frontier' | 'practicing' | 'mastered'

export interface MasteryState {
  skillId: string
  window: WindowEntry[] // last WINDOW_SIZE entries, newest last
  masteredAt?: string
  lastReviewedAt?: string
}

export interface SessionSettings {
  trialsPerSession: number
  domainsEnabled: Domain[]
  stimulation: 'calm' | 'normal'
  audioMode: 'tts' | 'clips'
}

export interface RewardCell {
  x: number
  y: number
  block: string
}

export interface RewardWorld {
  cols: number
  rows: number
  cells: RewardCell[]
}

export interface PlacementState {
  /** Domains still to probe after the current one. */
  domainQueue: Domain[]
  currentDomain: Domain
  /** Position on the current domain's difficulty ladder. */
  ladderIndex: number
  /** Result of the previous probe at this rung: null = fresh rung. */
  lastWasPass: boolean | null
  probesUsed: number
  provisionalMastered: string[]
  done: boolean
}

export interface Profile {
  id: string
  name: string
  createdAt: string
  settings: SessionSettings
  mastery: Record<string, MasteryState>
  /** Active during the first sessions; null once placement finished. Older profiles: undefined = no placement. */
  placement?: PlacementState | null
  /** Mechanics the child has met — first encounter of a template plays a demonstration round. */
  seenTemplates?: string[]
  inventory: Record<string, number> // blockType -> count
  world: RewardWorld
}

/** What the engine asks the UI to present next. */
export interface TrialPick {
  skillId: string
  templateId: string
  params: TemplateParams
}

export const WINDOW_SIZE = 8
export const MASTERY_THRESHOLD = 0.85
export const FRONTIER_SHARE = 0.8

export function defaultSettings(): SessionSettings {
  return {
    trialsPerSession: 10,
    domainsEnabled: [
      'subitizing',
      'counting',
      'numeral',
      'magnitude',
      'ordering',
      'addsub',
      'patterns',
    ],
    stimulation: 'normal',
    audioMode: 'tts',
  }
}

export function newProfile(id: string, name: string, now: string): Profile {
  return {
    id,
    name,
    createdAt: now,
    settings: defaultSettings(),
    mastery: {},
    inventory: {},
    world: { cols: 12, rows: 8, cells: [] },
  }
}
