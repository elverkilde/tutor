/**
 * Canonical list of template ids, kept free of UI imports so the pure
 * engine tests can validate skills.json against it.
 */
export const TEMPLATE_IDS = [
  'tap-more',
  'drag-to-chest',
  'numeral-match',
  'tower-build',
  'tens-and-ones',
  'number-line-hop',
  'line-add',
  'pattern-continue',
  'combine-count',
  'gather-sum',
  'take-away',
  'equation',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]
