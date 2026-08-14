import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'
import { rangeOf } from '../types'

type LineMode = 'goto' | 'after' | 'before'

export interface NumberLineData {
  line: number[]
  mode: LineMode
  /** the number that is spoken (target for goto, reference for after/before) */
  spoken: number
  answer: number
  /** scaffold 1: only these are tappable, the rest dim */
  active: number[] | null
}

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<NumberLineData> {
  const rng = mulberry32(seed)
  const [min, max] = rangeOf(params)
  const mode = (params['mode'] as LineMode) ?? 'goto'
  const lineMax = typeof params['lineMax'] === 'number' ? params['lineMax'] : 10
  const line = Array.from({ length: lineMax }, (_, i) => i + 1)

  const spoken = rng.int(min, max)
  const answer = mode === 'after' ? spoken + 1 : mode === 'before' ? spoken - 1 : spoken
  const phraseKey = mode === 'after' ? 'lineAfter' : mode === 'before' ? 'lineBefore' : 'lineGoto'

  return {
    templateId: 'number-line-hop',
    skillId,
    params,
    seed,
    promptPhrase: { key: phraseKey, n: spoken },
    data: { line, mode, spoken, answer, active: null },
  }
}

function applyScaffold(spec: TrialSpec<NumberLineData>, level: 0 | 1 | 2): TrialSpec<NumberLineData> {
  if (level === 0) return spec
  const { answer, line } = spec.data
  const active = line.filter((n) => Math.abs(n - answer) <= 1)
  return { ...spec, data: { ...spec.data, active } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<NumberLineData>) {
  const { line, mode, spoken, answer, active } = spec.data
  const [picked, setPicked] = useState<number | null>(null)
  const [demoTarget, setDemoTarget] = useState<number | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      if (!alive.current) return
      setDemoTarget(answer)
      await speak({ key: 'number', n: answer })
      await sleep(1500)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const pick = (n: number) => {
    if (picked !== null || demoing) return
    if (active && !active.includes(n)) return
    setPicked(n)
    onResponse({ correct: n === answer })
  }

  return (
    <div
      data-mode={mode}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '36px',
      }}
    >
      {/* For goto: the number to find, shown big (numeral -> position mapping). */}
      {mode === 'goto' && (
        <div
          data-testid="bubble"
          style={{
            fontSize: '4rem',
            fontWeight: 800,
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            padding: '6px 40px',
            boxShadow: 'var(--shadow)',
          }}
        >
          {spoken}
        </div>
      )}

      {/* The line itself */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
        {line.map((n) => {
          const isRef = mode !== 'goto' && n === spoken
          const dimmed = active !== null && !active.includes(n) && !isRef
          return (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                data-line-n={n}
                onClick={() => pick(n)}
                style={{
                  width: 'clamp(48px, 7vw, 64px)',
                  height: 'clamp(58px, 8vw, 74px)',
                  borderRadius: '12px',
                  fontSize: '1.9rem',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  background: isRef ? 'var(--gold)' : 'var(--card)',
                  opacity: dimmed ? 0.3 : 1,
                  boxShadow:
                    demoTarget === n ? '0 0 0 5px var(--good), var(--shadow)' : 'var(--shadow)',
                  animation:
                    demoTarget === n
                      ? 'gentle-pulse calc(700ms * var(--anim-scale, 1)) ease-in-out infinite'
                      : undefined,
                }}
              >
                {n}
              </button>
              <div style={{ width: '3px', height: '10px', background: 'var(--ink-soft)' }} />
            </div>
          )
        })}
      </div>
      <div
        style={{
          width: 'min(90%, 760px)',
          height: '6px',
          background: 'var(--ink-soft)',
          borderRadius: '3px',
          marginTop: '-32px',
        }}
      />
    </div>
  )
}

export const numberLineHop: TaskTemplate<NumberLineData> = {
  id: 'number-line-hop',
  generateTrial,
  applyScaffold,
  View,
}
