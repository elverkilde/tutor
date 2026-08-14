import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32, type Rng } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { BlockPile } from '../../ui/Block'
import { DigitChoices } from '../../ui/DigitChoices'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'

/** Concrete addition: two groups of blocks — how many in all? */
export interface CombineCountData {
  a: number
  b: number
  typeA: string
  typeB: string
  answer: number
  choices: number[]
}

export function digitChoicesAround(answer: number, count: number, max: number, rng: Rng): number[] {
  const distractors = new Set<number>()
  const candidates = rng.shuffle([answer - 1, answer + 1, answer - 2, answer + 2, answer - 3, answer + 3])
  for (const c of candidates) {
    if (distractors.size >= count - 1) break
    if (c >= 0 && c <= max && c !== answer) distractors.add(c)
  }
  return rng.shuffle([answer, ...distractors])
}

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<CombineCountData> {
  const rng = mulberry32(seed)
  const maxSum = typeof params['maxSum'] === 'number' ? params['maxSum'] : 5
  const a = rng.int(1, maxSum - 1)
  const b = rng.int(1, maxSum - a)
  const [typeA, typeB] = rng.shuffle(['grass', 'stone', 'wood', 'gold']).slice(0, 2)
  const answer = a + b
  return {
    templateId: 'combine-count',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'combineCount' },
    data: { a, b, typeA, typeB, answer, choices: digitChoicesAround(answer, 3, Math.max(10, maxSum), rng) },
  }
}

function applyScaffold(spec: TrialSpec<CombineCountData>, level: 0 | 1 | 2): TrialSpec<CombineCountData> {
  if (level === 0 || spec.data.choices.length <= 2) return spec
  const { answer, choices } = spec.data
  const far = [...choices].filter((c) => c !== answer).sort((x, y) => Math.abs(y - answer) - Math.abs(x - answer))[0]
  return { ...spec, data: { ...spec.data, choices: choices.filter((c) => c === answer || c === far) } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<CombineCountData>) {
  const { a, b, typeA, typeB, answer, choices } = spec.data
  const [picked, setPicked] = useState<number | null>(null)
  const [countedUpTo, setCountedUpTo] = useState(-1)
  const [demoDigit, setDemoDigit] = useState<number | null>(null)
  // Touch-counting dots (no numbers — they would reveal the sum)
  const [marksA, setMarksA] = useState<Set<number>>(new Set())
  const [marksB, setMarksB] = useState<Set<number>>(new Set())
  const toggle = (set: typeof setMarksA) => (i: number) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      // Count straight across both groups — the heart of "counting all".
      for (let i = 0; i < a + b; i++) {
        if (!alive.current) return
        setCountedUpTo(i)
        await speak({ key: 'number', n: i + 1 })
        await sleep(220)
      }
      if (!alive.current) return
      setDemoDigit(answer)
      await sleep(1500)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const pick = (n: number) => {
    if (picked !== null || demoing) return
    setPicked(n)
    onResponse({ correct: n === answer })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', justifyContent: 'center' }}>
      <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'stretch' }}>
        <div
          data-testid="pile-a"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: '14px',
          }}
        >
          <BlockPile count={a} type={typeA} size={46} highlightIndex={countedUpTo} marks={marksA} onTapBlock={toggle(setMarksA)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '3rem', fontWeight: 800, color: 'var(--ink-soft)' }}>
          +
        </div>
        <div
          data-testid="pile-b"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: '14px',
          }}
        >
          <BlockPile count={b} type={typeB} size={46} highlightIndex={countedUpTo - a} marks={marksB} onTapBlock={toggle(setMarksB)} />
        </div>
      </div>
      <DigitChoices choices={choices} onPick={pick} demoDigit={demoDigit} disabled={demoing || picked !== null} />
    </div>
  )
}

export const combineCount: TaskTemplate<CombineCountData> = {
  id: 'combine-count',
  generateTrial,
  applyScaffold,
  View,
}
