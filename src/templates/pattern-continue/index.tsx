import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'

type PatternKind = 'ab' | 'abc' | 'aabb' | 'mixed'

export interface PatternData {
  /** the visible sequence; the next element is the question */
  sequence: string[]
  answer: string
  choices: string[]
  unitLength: number
}

const KINDS = ['grass', 'stone', 'wood', 'gold', 'diamond', 'brick']

function buildUnit(kind: PatternKind, rng: ReturnType<typeof mulberry32>): string[] {
  const pool = rng.shuffle(KINDS)
  switch (kind) {
    case 'ab':
      return [pool[0], pool[1]]
    case 'abc':
      return [pool[0], pool[1], pool[2]]
    case 'aabb':
      return [pool[0], pool[0], pool[1], pool[1]]
    case 'mixed': {
      // A 3-long unit from 3 kinds, e.g. ABA / ABB / ABC — never constant.
      const shapes = [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 2],
        [0, 0, 1],
      ]
      const shape = rng.pick(shapes)
      return shape.map((i) => pool[i])
    }
  }
}

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<PatternData> {
  const rng = mulberry32(seed)
  const kind = (params['pattern'] as PatternKind) ?? 'ab'
  const unit = buildUnit(kind, rng)

  // Show at least two full repetitions plus 0-1 extra, then ask for the next.
  const extra = rng.int(0, 1)
  const len = unit.length * 2 + extra
  const sequence = Array.from({ length: len }, (_, i) => unit[i % unit.length])
  const answer = unit[len % unit.length]

  const others = [...new Set(unit)].filter((k) => k !== answer)
  while (others.length < 2) {
    const extraKind = KINDS.find((k) => k !== answer && !others.includes(k))!
    others.push(extraKind)
  }
  const choices = rng.shuffle([answer, ...others.slice(0, 2)])

  return {
    templateId: 'pattern-continue',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'patternNext' },
    data: { sequence, answer, choices, unitLength: unit.length },
  }
}

function applyScaffold(spec: TrialSpec<PatternData>, level: 0 | 1 | 2): TrialSpec<PatternData> {
  if (level === 0 || spec.data.choices.length <= 2) return spec
  const { answer, choices } = spec.data
  const other = choices.find((c) => c !== answer)!
  const reduced = choices.filter((c) => c === answer || c === other)
  return { ...spec, data: { ...spec.data, choices: reduced } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<PatternData>) {
  const { sequence, answer, choices, unitLength } = spec.data
  const [picked, setPicked] = useState<string | null>(null)
  const [pulseIndex, setPulseIndex] = useState(-1)
  const [demoChoice, setDemoChoice] = useState<string | null>(null)
  const [filled, setFilled] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      // Walk the sequence rhythmically so the repeating unit becomes audible/visible.
      for (let i = 0; i < sequence.length; i++) {
        if (!alive.current) return
        setPulseIndex(i)
        await sleep(i % unitLength === unitLength - 1 ? 550 : 320)
      }
      if (!alive.current) return
      setPulseIndex(-1)
      setDemoChoice(answer)
      setFilled(answer)
      await sleep(1700)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const pick = (c: string) => {
    if (picked !== null || demoing) return
    setPicked(c)
    if (c === answer) setFilled(c)
    onResponse({ correct: c === answer })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px', justifyContent: 'center' }}>
      {/* The pattern strip */}
      <div
        data-testid="pattern"
        data-unit={unitLength}
        style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '22px 16px',
          flexWrap: 'wrap',
        }}
      >
        {sequence.map((b, i) => (
          <div key={i} data-block={b} style={{ transform: pulseIndex === i ? 'scale(1.18)' : 'scale(1)', transition: 'transform 150ms' }}>
            <Block type={b} size={46} highlight={pulseIndex === i} />
          </div>
        ))}
        {/* The empty slot to fill */}
        <div
          data-block={filled ?? '?'}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '4px',
            border: filled ? 'none' : '3px dashed var(--ink-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--ink-soft)',
          }}
        >
          {filled ? <Block type={filled} size={46} /> : '?'}
        </div>
      </div>

      {/* Choices */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
        {choices.map((c) => (
          <button
            key={c}
            data-choice={c}
            onClick={() => pick(c)}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius)',
              background: 'var(--card)',
              boxShadow:
                demoChoice === c ? '0 0 0 5px var(--good), var(--shadow)' : 'var(--shadow)',
              animation:
                demoChoice === c
                  ? 'gentle-pulse calc(700ms * var(--anim-scale, 1)) ease-in-out infinite'
                  : undefined,
            }}
          >
            <Block type={c} size={56} />
          </button>
        ))}
      </div>
    </div>
  )
}

export const patternContinue: TaskTemplate<PatternData> = {
  id: 'pattern-continue',
  generateTrial,
  applyScaffold,
  View,
}
