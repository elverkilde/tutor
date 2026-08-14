import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'

/**
 * Addition as counting on: a figure stands on the start number; each tap on
 * the NEXT tile hops it one step forward while the app speaks the landing
 * number ("seks... syv... otte"). The child stops after the right number of
 * hops and presses the check. Taps are the hops — his touch-counting, made
 * into the operation itself. Tapping the tile behind hops back (undo without
 * anything being destroyed); tapping the current tile just says where he is.
 */
export interface LineAddData {
  line: number[]
  start: number
  hops: number
  answer: number
  /** scaffold 1: dashed rings mark the path still to hop */
  showPath: boolean
}

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<LineAddData> {
  const rng = mulberry32(seed)
  const lineMax = typeof params['lineMax'] === 'number' ? params['lineMax'] : 10
  const maxHops = typeof params['maxHops'] === 'number' ? params['maxHops'] : 4
  const hops = rng.int(1, maxHops)
  const start = rng.int(1, lineMax - hops)
  return {
    templateId: 'line-add',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'lineAdd', n: start, n2: hops },
    data: {
      line: Array.from({ length: lineMax }, (_, i) => i + 1),
      start,
      hops,
      answer: start + hops,
      showPath: false,
    },
  }
}

function applyScaffold(spec: TrialSpec<LineAddData>, level: 0 | 1 | 2): TrialSpec<LineAddData> {
  if (level === 0) return spec
  return { ...spec, data: { ...spec.data, showPath: true } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<LineAddData>) {
  const { line, start, hops, answer, showPath } = spec.data
  const [pos, setPos] = useState(start)
  const [submitted, setSubmitted] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      for (let p = start + 1; p <= answer; p++) {
        if (!alive.current) return
        setPos(p)
        await speak({ key: 'number', n: p })
        await sleep(320)
      }
      await sleep(1300)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const tapTile = (n: number) => {
    if (demoing || submitted) return
    if (n === pos + 1 && n <= line.length) {
      setPos(n)
      void speak({ key: 'number', n })
    } else if (n === pos - 1 && n >= start) {
      // Hop back: overshoot is undone by movement, never by removal.
      setPos(n)
      void speak({ key: 'number', n })
    } else if (n === pos) {
      void speak({ key: 'number', n })
    }
  }

  const submit = () => {
    if (demoing || submitted || pos === start) return
    setSubmitted(true)
    onResponse({ correct: pos === answer })
  }

  return (
    <div
      data-testid="line-add"
      data-start={start}
      data-hops={hops}
      data-pos={pos}
      style={{ display: 'flex', height: '100%', gap: '16px', alignItems: 'stretch' }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
          {line.map((n) => {
            const visited = n > start && n <= pos
            const onPath = showPath && n > pos && n <= answer
            return (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* The figure stands on its tile; keyed on pos so each hop pops */}
                <div style={{ height: '44px', display: 'flex', alignItems: 'flex-end' }}>
                  {pos === n && (
                    <div key={`hop-${pos}`} style={{ animation: 'pop-in var(--anim-fast) ease-out' }}>
                      <Block type="grass" size={38} highlight={!demoing && !submitted} />
                    </div>
                  )}
                </div>
                <button
                  data-line-n={n}
                  onClick={() => tapTile(n)}
                  style={{
                    width: 'clamp(48px, 7vw, 64px)',
                    height: 'clamp(58px, 8vw, 74px)',
                    borderRadius: '12px',
                    fontSize: '1.9rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    background: n === start ? 'var(--gold)' : visited ? '#dff0e2' : 'var(--card)',
                    boxShadow: onPath ? 'inset 0 0 0 3px var(--focus), var(--shadow)' : 'var(--shadow)',
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
            marginTop: '-14px',
          }}
        />
      </div>

      {/* Submit: same green check as the chest games */}
      <button
        onClick={submit}
        disabled={pos === start || demoing || submitted}
        aria-label="Færdig"
        style={{
          width: 'calc(var(--tap-target) * 1.2)',
          borderRadius: 'var(--radius)',
          background: pos !== start && !demoing ? 'var(--good)' : '#c9d4cd',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--anim-fast)',
          alignSelf: 'center',
          height: '140px',
        }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5 L9.5 18 L20 6.5" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  )
}

export const lineAdd: TaskTemplate<LineAddData> = {
  id: 'line-add',
  generateTrial,
  applyScaffold,
  View,
}
