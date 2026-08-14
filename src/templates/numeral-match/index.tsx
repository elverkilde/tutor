import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { BlockPile } from '../../ui/Block'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'
import { rangeOf } from '../types'

export interface NumeralMatchData {
  count: number
  choices: number[]
  blockType: string
  /**
   * Teen mode: taps count aloud cumulatively instead of toggling silent dots.
   * For 1-10 the spoken count would hand over an answer he should produce
   * himself; for 11-20 hearing the sequence IS the training (spoken "sytten"
   * -> written 17 is the mapping being built).
   */
  countAloud: boolean
}

const BLOCK_CHOICES = ['grass', 'stone', 'wood', 'dirt']

function generateTrial(
  skillId: string,
  params: TemplateParams,
  seed: number,
): TrialSpec<NumeralMatchData> {
  const rng = mulberry32(seed)
  const [min, max] = rangeOf(params)
  const choiceCount = typeof params['choices'] === 'number' ? params['choices'] : 3

  const count = rng.int(min, max)
  const distractors = new Set<number>()
  // Neighbors first — near-misses are what actually train the mapping.
  // Distractors stay within [min-3, max] so they're plausible but never
  // numerals beyond what the skill range has introduced.
  const lo = Math.max(1, min - 3)
  const candidates = rng.shuffle([count - 1, count + 1, count - 2, count + 2, count - 3, count + 3])
  for (const c of candidates) {
    if (distractors.size >= choiceCount - 1) break
    if (c >= lo && c <= max && c !== count) distractors.add(c)
  }
  const choices = rng.shuffle([count, ...distractors])
  const countAloud = params['countAloud'] === true

  return {
    templateId: 'numeral-match',
    skillId,
    params,
    seed,
    promptPhrase: { key: countAloud ? 'numeralCount' : 'numeralMatch' },
    data: { count, choices, blockType: rng.pick(BLOCK_CHOICES), countAloud },
  }
}

function applyScaffold(
  spec: TrialSpec<NumeralMatchData>,
  level: 0 | 1 | 2,
): TrialSpec<NumeralMatchData> {
  if (level === 0 || spec.data.choices.length <= 2) return spec
  const { count, choices } = spec.data
  // Keep the correct answer plus the farthest distractor — an easier contrast.
  const far = [...choices]
    .filter((c) => c !== count)
    .sort((a, b) => Math.abs(b - count) - Math.abs(a - count))[0]
  const reduced = choices.filter((c) => c === count || c === far)
  return { ...spec, data: { ...spec.data, choices: reduced } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<NumeralMatchData>) {
  const { count, choices, blockType, countAloud } = spec.data
  const [picked, setPicked] = useState<number | null>(null)
  const [countedUpTo, setCountedUpTo] = useState(-1)
  const [demoDigit, setDemoDigit] = useState<number | null>(null)
  // Touch-counting support: tapping a block toggles a small "counted" dot.
  // No numbers shown — that would hand over the answer.
  const [marks, setMarks] = useState<Set<number>>(new Set())
  const toggleMark = (i: number) =>
    setMarks((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  // countAloud: taps count in order and the app says the running count —
  // tapping an already-counted block restarts the count from it (same
  // ritual as the chest games). Dots only, never numerals.
  const [countedOrder, setCountedOrder] = useState<number[]>([])
  const tapCount = (i: number) =>
    setCountedOrder((prev) => {
      if (prev.includes(i)) {
        void speak({ key: 'number', n: 1 })
        return [i]
      }
      void speak({ key: 'number', n: prev.length + 1 })
      return [...prev, i]
    })
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  useEffect(() => {
    if (scaffoldLevel !== 2) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      // Count the blocks one by one, aloud.
      for (let i = 0; i < count; i++) {
        if (!alive.current) return
        setCountedUpTo(i)
        await speak({ key: 'number', n: i + 1 })
        await sleep(250)
      }
      if (!alive.current) return
      setDemoDigit(count)
      await sleep(1600)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [scaffoldLevel])

  const pick = (n: number) => {
    if (picked !== null || scaffoldLevel === 2) return
    setPicked(n)
    onResponse({ correct: n === count })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '20px',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '18px',
        }}
      >
        <BlockPile
          count={count}
          type={blockType}
          size={52}
          highlightIndex={
            scaffoldLevel === 2
              ? countedUpTo
              : countAloud
                ? (countedOrder[countedOrder.length - 1] ?? -1)
                : -1
          }
          marks={countAloud ? new Set(countedOrder) : marks}
          onTapBlock={countAloud ? tapCount : toggleMark}
        />
      </div>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
        {choices.map((n) => (
          <button
            key={n}
            onClick={() => pick(n)}
            style={{
              width: '110px',
              height: '96px',
              fontSize: '3.2rem',
              fontWeight: 800,
              color: 'var(--ink)',
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              boxShadow:
                demoDigit === n ? '0 0 0 5px var(--good), var(--shadow)' : 'var(--shadow)',
              animation:
                demoDigit === n
                  ? 'gentle-pulse calc(700ms * var(--anim-scale, 1)) ease-in-out infinite'
                  : undefined,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export const numeralMatch: TaskTemplate<NumeralMatchData> = {
  id: 'numeral-match',
  generateTrial,
  applyScaffold,
  View,
}
