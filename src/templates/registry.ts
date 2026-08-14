import type { TaskTemplate } from './types'
import { TEMPLATE_IDS } from './ids'
import { tapMore } from './tap-more'
import { dragToChest } from './drag-to-chest'
import { numeralMatch } from './numeral-match'
import { towerBuild } from './tower-build'
import { numberLineHop } from './number-line-hop'
import { patternContinue } from './pattern-continue'
import { combineCount } from './combine-count'
import { takeAway } from './take-away'
import { equation } from './equation'

export const templates: Record<string, TaskTemplate<any>> = {
  'tap-more': tapMore,
  'drag-to-chest': dragToChest,
  'numeral-match': numeralMatch,
  'tower-build': towerBuild,
  'number-line-hop': numberLineHop,
  'pattern-continue': patternContinue,
  'combine-count': combineCount,
  'take-away': takeAway,
  equation: equation,
}

// Keep the pure id list (used by engine tests) honest.
for (const id of TEMPLATE_IDS) {
  if (!templates[id]) throw new Error(`template listed in ids.ts but not registered: ${id}`)
}
