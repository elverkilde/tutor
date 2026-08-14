import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { BlockPile } from '../../ui/Block'
import { DigitChoices } from '../../ui/DigitChoices'
import { sleep } from '../../ui/async'
import { digitChoicesAround } from '../combine-count'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'

/** Abstract arithmetic: bare symbols. The scaffold falls back to piles (CRA). */
export interface EquationData {
  a: number
  b: number
  op: 'plus' | 'minus'
  answer: number
  choices: number[]
  blockType: string
  /** scaffold 1: show block piles under the numerals */
  showPiles: boolean
}

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<EquationData> {
  const rng = mulberry32(seed)
  const op = (params['op'] as 'plus' | 'minus') ?? 'plus'
  const max = typeof params['max'] === 'number' ? params['max'] : 5
  let a: number, b: number, answer: number
  if (op === 'plus') {
    a = rng.int(1, max - 1)
    b = rng.int(1, max - a)
    answer = a + b
  } else {
    a = rng.int(2, max)
    b = rng.int(1, a - 1)
    answer = a - b
  }
  return {
    templateId: 'equation',
    skillId,
    params,
    seed,
    promptPhrase: { key: op === 'plus' ? 'plusEquation' : 'minusEquation', n: a, n2: b },
    data: {
      a,
      b,
      op,
      answer,
      choices: digitChoicesAround(answer, 3, Math.max(10, max), rng),
      blockType: rng.pick(['grass', 'stone', 'wood']),
      showPiles: false,
    },
  }
}

function applyScaffold(spec: TrialSpec<EquationData>, level: 0 | 1 | 2): TrialSpec<EquationData> {
  if (level === 0) return spec
  // The CRA fallback: same numbers, now with visible quantities.
  return { ...spec, data: { ...spec.data, showPiles: true } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<EquationData>) {
  const { a, b, op, answer, choices, blockType, showPiles } = spec.data
  const [picked, setPicked] = useState<number | null>(null)
  const [demoDigit, setDemoDigit] = useState<number | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      await speak({ key: op === 'plus' ? 'plusEquation' : 'minusEquation', n: a, n2: b })
      if (!alive.current) return
      setDemoDigit(answer)
      await speak({ key: 'number', n: answer })
      await sleep(1400)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const pick = (n: number) => {
    if (picked !== null || demoing) return
    setPicked(n)
    onResponse({ correct: n === answer })
  }

  const operand = (value: number, pileCount: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '4.4rem', fontWeight: 800 }}>{value}</span>
      {showPiles && <BlockPile count={pileCount} type={blockType} size={26} />}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px', justifyContent: 'center' }}>
      <div
        data-testid="equation"
        data-a={a}
        data-b={b}
        data-op={op}
        style={{
          display: 'flex',
          gap: '28px',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '26px',
        }}
      >
        {operand(a, a)}
        <span style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--ink-soft)' }}>
          {op === 'plus' ? '+' : '−'}
        </span>
        {operand(b, b)}
        <span style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--ink-soft)' }}>=</span>
        <span style={{ fontSize: '4.4rem', fontWeight: 800, color: 'var(--ink-soft)' }}>?</span>
      </div>
      <DigitChoices choices={choices} onPick={pick} demoDigit={demoDigit} disabled={demoing || picked !== null} />
    </div>
  )
}

export const equation: TaskTemplate<EquationData> = {
  id: 'equation',
  generateTrial,
  applyScaffold,
  View,
}
