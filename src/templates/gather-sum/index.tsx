import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { DigitChoices } from '../../ui/DigitChoices'
import { TargetSign } from '../../ui/TargetSign'
import { sleep } from '../../ui/async'
import { digitChoicesAround } from '../combine-count'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'

/**
 * Enactive addition: two trays of blocks, one chest. The child JOINS the sets
 * by dragging everything in — addition as an action he performs, not a
 * picture he decodes. The two block types stay distinct inside the chest, so
 * the addends remain visible inside the sum. Digit choices only appear once
 * everything is gathered: act first, then name the total.
 *
 * Concreteness fading: the symbols narrate the action instead of replacing
 * it. Each tray wears its numeral from the start; the moment gathering
 * completes, the expression banner appears ("3 + 4 = ?") and the app asks it
 * aloud — naming what he just did — and a correct answer fills the banner in.
 */
export interface GatherSumData {
  a: number
  b: number
  typeA: string
  typeB: string
  answer: number
  choices: number[]
}

const BLOCK = 48
const CHEST_BLOCK = 44
const DRAG_THRESHOLD = 12

/** Items are keyed by tray: 'a0'.. and 'b0'.. */
type ItemKey = string

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<GatherSumData> {
  const rng = mulberry32(seed)
  const maxSum = typeof params['maxSum'] === 'number' ? params['maxSum'] : 5
  const a = rng.int(1, maxSum - 1)
  const b = rng.int(1, maxSum - a)
  const [typeA, typeB] = rng.shuffle(['grass', 'stone', 'wood', 'gold']).slice(0, 2)
  const answer = a + b
  return {
    templateId: 'gather-sum',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'gatherSum' },
    data: { a, b, typeA, typeB, answer, choices: digitChoicesAround(answer, 3, Math.max(10, maxSum), rng) },
  }
}

function applyScaffold(spec: TrialSpec<GatherSumData>, level: 0 | 1 | 2): TrialSpec<GatherSumData> {
  if (level === 0 || spec.data.choices.length <= 2) return spec
  const { answer, choices } = spec.data
  const far = [...choices].filter((c) => c !== answer).sort((x, y) => Math.abs(y - answer) - Math.abs(x - answer))[0]
  return { ...spec, data: { ...spec.data, choices: choices.filter((c) => c === answer || c === far) } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<GatherSumData>) {
  const { a, b, typeA, typeB, answer, choices } = spec.data
  const [placed, setPlaced] = useState<ItemKey[]>([])
  /** itemKey -> count badge from touch-counting (taps never destroy) */
  const [counts, setCounts] = useState<Record<ItemKey, number>>({})
  const [drag, setDrag] = useState<{ key: ItemKey; x: number; y: number; from: 'source' | 'chest' } | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [demoDigit, setDemoDigit] = useState<number | null>(null)
  const press = useRef<{ key: ItemKey; from: 'source' | 'chest'; x0: number; y0: number; moved: boolean } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const typeOf = (key: ItemKey) => (key.startsWith('a') ? typeA : typeB)
  const complete = placed.length === a + b

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      // Gather while counting straight across the union: 1..a, then a+1..a+b.
      for (let i = 0; i < a + b; i++) {
        if (!alive.current) return
        setPlaced((p) => [...p, i < a ? `a${i}` : `b${i - a}`])
        await speak({ key: 'number', n: i + 1 })
        await sleep(220)
      }
      if (!alive.current) return
      setDemoDigit(answer)
      await speak({ key: 'plusIs', n: a, n2: b })
      await sleep(1200)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  // The linking moment: everything just got joined — name it in symbols.
  const spokeExpression = useRef(false)
  useEffect(() => {
    if (!complete) {
      spokeExpression.current = false
      return
    }
    if (demoing || spokeExpression.current) return
    spokeExpression.current = true
    void speak({ key: 'plusEquation', n: a, n2: b })
  }, [complete, demoing])

  const insideChest = (x: number, y: number) => {
    const r = chestRef.current?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  const down = (key: ItemKey, from: 'source' | 'chest') => (e: PointerEvent) => {
    if (demoing || picked !== null) return
    if (from === 'source' && placed.includes(key)) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    press.current = { key, from, x0: e.clientX, y0: e.clientY, moved: false }
    if (from === 'source') setDrag({ key, x: e.clientX, y: e.clientY, from })
  }

  const move = (e: PointerEvent) => {
    const p = press.current
    if (!p) return
    if (!p.moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > DRAG_THRESHOLD) p.moved = true
    if (p.from === 'source' || p.moved) setDrag({ key: p.key, x: e.clientX, y: e.clientY, from: p.from })
  }

  const up = (e: PointerEvent) => {
    const p = press.current
    press.current = null
    setDrag(null)
    if (!p || demoing || picked !== null) return
    if (p.from === 'source') {
      if (insideChest(e.clientX, e.clientY)) {
        setPlaced((prev) => (prev.includes(p.key) ? prev : [...prev, p.key]))
        setCounts({})
      }
    } else if (p.moved) {
      if (!insideChest(e.clientX, e.clientY)) {
        setPlaced((prev) => prev.filter((k) => k !== p.key))
        setCounts({})
      }
    } else {
      tapCount(p.key)
    }
  }

  /** Touch-counting in the chest: badge 1, 2, 3... and say the number. */
  const tapCount = (key: ItemKey) => {
    setCounts((prev) => {
      if (prev[key] !== undefined) {
        // Tapping an already-counted block restarts the count from it.
        void speak({ key: 'number', n: 1 })
        return { [key]: 1 }
      }
      const next = Object.keys(prev).length + 1
      void speak({ key: 'number', n: next })
      return { ...prev, [key]: next }
    })
  }

  const pick = (n: number) => {
    if (picked !== null || demoing || !complete) return
    setPicked(n)
    onResponse({ correct: n === answer })
  }

  const latestCount = Object.keys(counts).length

  const tray = (testid: string, count: number, type: string, prefix: 'a' | 'b') => (
    <div
      data-testid={testid}
      style={{
        flex: 1,
        position: 'relative',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        padding: '14px',
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(count, 5)}, ${BLOCK}px)`,
        gap: '12px',
        justifyContent: 'center',
        alignContent: 'center',
      }}
    >
      <TargetSign value={count} />
      {Array.from({ length: count }, (_, i) => {
        const key = `${prefix}${i}`
        return (
          <div
            key={key}
            class="draggable"
            onPointerDown={down(key, 'source')}
            onPointerMove={move}
            onPointerUp={up}
            style={{ visibility: placed.includes(key) ? 'hidden' : 'visible' }}
          >
            <Block type={type} size={BLOCK} />
          </div>
        )
      })}
    </div>
  )

  const revealed = demoDigit !== null || picked === answer

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
      {/* The two sets to join — each tray wears its numeral (room for the signs above) */}
      <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'stretch', marginTop: '20px' }}>
        {tray('tray-a', a, typeA, 'a')}
        {tray('tray-b', b, typeB, 'b')}
      </div>

      {/* The chest: unknown total on the sign */}
      <div
        ref={chestRef}
        data-testid="chest"
        style={{
          minHeight: '128px',
          background: 'var(--wood)',
          border: '6px solid var(--dirt-dark)',
          borderRadius: 'var(--radius)',
          padding: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignContent: 'flex-start',
          position: 'relative',
        }}
      >
        <TargetSign value="?" />
        {placed.map((key) => {
          const badge = counts[key]
          const beingDragged = drag?.from === 'chest' && drag.key === key
          return (
            <div
              key={key}
              class="draggable"
              onPointerDown={down(key, 'chest')}
              onPointerMove={move}
              onPointerUp={up}
              style={{
                position: 'relative',
                animation: 'pop-in var(--anim-fast) ease-out',
                opacity: beingDragged ? 0.25 : 1,
              }}
            >
              <Block type={typeOf(key)} size={CHEST_BLOCK} highlight={badge !== undefined && badge === latestCount} />
              {badge !== undefined && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-9px',
                    right: '-9px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'var(--focus)',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {badge}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* The expression assembles the moment the joining is done: "3 + 4 = ?" */}
      <div style={{ minHeight: '58px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {complete && (
          <div
            data-testid="expression"
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              padding: '2px 26px',
              fontSize: '2.4rem',
              fontWeight: 800,
              color: 'var(--ink)',
              animation: 'pop-in var(--anim-fast) ease-out',
            }}
          >
            <span>{a}</span>
            <span style={{ color: 'var(--ink-soft)' }}>+</span>
            <span>{b}</span>
            <span style={{ color: 'var(--ink-soft)' }}>=</span>
            <span style={{ color: revealed ? 'var(--good)' : 'var(--ink-soft)' }}>
              {revealed ? answer : '?'}
            </span>
          </div>
        )}
      </div>

      {/* The answer row appears once everything is gathered: act, then name */}
      <div style={{ minHeight: '96px' }}>
        {complete && (
          <div style={{ animation: 'pop-in var(--anim-fast) ease-out' }}>
            <DigitChoices choices={choices} onPick={pick} demoDigit={demoDigit} disabled={demoing || picked !== null} />
          </div>
        )}
      </div>

      {/* Floating block that follows the finger */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: `${drag.x - BLOCK / 2}px`,
            top: `${drag.y - BLOCK / 2}px`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <Block type={typeOf(drag.key)} size={BLOCK} highlight />
        </div>
      )}
    </div>
  )
}

export const gatherSum: TaskTemplate<GatherSumData> = {
  id: 'gather-sum',
  generateTrial,
  applyScaffold,
  View,
}
