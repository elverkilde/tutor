import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { TargetSign } from '../../ui/TargetSign'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'
import { rangeOf } from '../types'

export interface TensAndOnesData {
  target: number // 11..20
  tens: number // ten-rods needed
  ones: number // loose blocks needed
  rodsAvailable: number
  singlesAvailable: number
  blockType: string
  /** scaffold 1: dashed outlines show the rod + singles decomposition */
  showSlots: boolean
}

const BLOCK_CHOICES = ['grass', 'stone', 'wood', 'dirt']
const SEG = 24 // one segment of a ten-rod
const ROD_W = 10 * SEG + 9 * 2 + 8 // segments + gaps + padding
const SINGLE = 52
const CHEST_SINGLE = 44
const DRAG_THRESHOLD = 12

/** Items are keyed 'r0','r1' (rods) and 's0'... (singles). */
type ItemKey = string
const isRod = (k: ItemKey) => k.startsWith('r')
const valueOf = (k: ItemKey) => (isRod(k) ? 10 : 1)

function generateTrial(
  skillId: string,
  params: TemplateParams,
  seed: number,
): TrialSpec<TensAndOnesData> {
  const rng = mulberry32(seed)
  const [min, max] = rangeOf(params)
  const target = rng.int(min, max)
  const tens = Math.floor(target / 10)
  const ones = target % 10
  return {
    templateId: 'tens-and-ones',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'tensChest', n: target },
    data: {
      target,
      tens,
      ones,
      rodsAvailable: 2,
      // Spare singles always exist, but never enough to reach the target
      // without a rod — the ten-structure is the lesson, not optional.
      singlesAvailable: ones + rng.int(2, 3),
      blockType: rng.pick(BLOCK_CHOICES),
      showSlots: false,
    },
  }
}

function applyScaffold(
  spec: TrialSpec<TensAndOnesData>,
  level: 0 | 1 | 2,
): TrialSpec<TensAndOnesData> {
  if (level === 0) return spec
  return { ...spec, data: { ...spec.data, showSlots: true } }
}

/** A ten-rod: ten blocks fused in a tray so it reads (and drags) as one thing. */
function TenRod({ blockType, highlight = false }: { blockType: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        padding: '4px',
        borderRadius: '8px',
        background: 'rgba(0,0,0,0.22)',
        boxShadow: highlight ? '0 0 0 4px var(--focus)' : '0 2px 0 rgba(0,0,0,0.15)',
      }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Block key={i} type={blockType} size={SEG} />
      ))}
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '-9px',
        right: '-9px',
        minWidth: '26px',
        height: '26px',
        padding: '0 4px',
        borderRadius: '13px',
        background: 'var(--focus)',
        color: 'white',
        fontSize: '1rem',
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {n}
    </div>
  )
}

/**
 * "Ten and some more": the same chest game, but the supply holds ten-rods
 * next to loose blocks, so 17 is one rod + seven singles — eight drags, not
 * seventeen. Taps never destroy: tapping chest contents counts them aloud
 * cumulatively (a rod advances the count by ten: "ti", then "elleve, tolv…"),
 * which is exactly the teen sequence we want him to hear. Removal is drag-only.
 */
function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<TensAndOnesData>) {
  const { target, tens, ones, rodsAvailable, singlesAvailable, blockType, showSlots } = spec.data
  const [placed, setPlaced] = useState<ItemKey[]>([])
  /** Touch-counting order; badge value = running total up to that item. */
  const [countedOrder, setCountedOrder] = useState<ItemKey[]>([])
  const [drag, setDrag] = useState<{ key: ItemKey; x: number; y: number; from: 'source' | 'chest' } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const press = useRef<{ key: ItemKey; from: 'source' | 'chest'; x0: number; y0: number; moved: boolean } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      for (let t = 0; t < tens; t++) {
        if (!alive.current) return
        setPlaced((p) => [...p, `r${t}`])
        await speak({ key: 'number', n: (t + 1) * 10 })
        await sleep(320)
      }
      for (let o = 0; o < ones; o++) {
        if (!alive.current) return
        setPlaced((p) => [...p, `s${o}`])
        await speak({ key: 'number', n: tens * 10 + o + 1 })
        await sleep(250)
      }
      await sleep(1200)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const insideChest = (x: number, y: number) => {
    const r = chestRef.current?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  const down = (key: ItemKey, from: 'source' | 'chest') => (e: PointerEvent) => {
    if (demoing || submitted) return
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
    if (!p || demoing || submitted) return
    if (p.from === 'source') {
      if (insideChest(e.clientX, e.clientY)) {
        setPlaced((prev) => (prev.includes(p.key) ? prev : [...prev, p.key]))
        setCountedOrder([])
      }
    } else if (p.moved) {
      if (!insideChest(e.clientX, e.clientY)) {
        setPlaced((prev) => prev.filter((k) => k !== p.key))
        setCountedOrder([])
      }
    } else {
      tapCount(p.key)
    }
  }

  /** Cumulative touch-counting: a rod adds ten, a single adds one. */
  const tapCount = (key: ItemKey) => {
    setCountedOrder((prev) => {
      if (prev.includes(key)) {
        // Tapping an already-counted item restarts the count from it.
        void speak({ key: 'number', n: valueOf(key) })
        return [key]
      }
      const total = prev.reduce((s, k) => s + valueOf(k), 0) + valueOf(key)
      void speak({ key: 'number', n: total })
      return [...prev, key]
    })
  }

  const submit = () => {
    if (demoing || submitted || placed.length === 0) return
    setSubmitted(true)
    const total = placed.reduce((s, k) => s + valueOf(k), 0)
    onResponse({ correct: total === target })
  }

  const badges = new Map<ItemKey, number>()
  let running = 0
  for (const k of countedOrder) {
    running += valueOf(k)
    badges.set(k, running)
  }
  const latestKey = countedOrder[countedOrder.length - 1]

  const placedRods = placed.filter(isRod)
  const placedSingles = placed.filter((k) => !isRod(k))
  const rodSlots = showSlots ? Math.max(0, tens - placedRods.length) : 0
  const singleSlots = showSlots ? Math.max(0, ones - placedSingles.length) : 0

  const chestItem = (key: ItemKey) => {
    const badge = badges.get(key)
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
        {isRod(key) ? (
          <TenRod blockType={blockType} highlight={badge !== undefined && key === latestKey} />
        ) : (
          <Block type={blockType} size={CHEST_SINGLE} highlight={badge !== undefined && key === latestKey} />
        )}
        {badge !== undefined && <CountBadge n={badge} />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Supply: ten-rods beside loose blocks */}
      <div
        style={{
          flex: 1,
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '16px',
          display: 'flex',
          gap: '28px',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Array.from({ length: rodsAvailable }, (_, i) => {
            const key = `r${i}`
            return (
              <div
                key={key}
                class="draggable"
                onPointerDown={down(key, 'source')}
                onPointerMove={move}
                onPointerUp={up}
                style={{ visibility: placed.includes(key) ? 'hidden' : 'visible' }}
              >
                <TenRod blockType={blockType} />
              </div>
            )
          })}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(4, ${SINGLE}px)`,
            gap: '12px',
          }}
        >
          {Array.from({ length: singlesAvailable }, (_, i) => {
            const key = `s${i}`
            return (
              <div
                key={key}
                class="draggable"
                onPointerDown={down(key, 'source')}
                onPointerMove={move}
                onPointerUp={up}
                style={{ visibility: placed.includes(key) ? 'hidden' : 'visible' }}
              >
                <Block type={blockType} size={SINGLE} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Chest: rods stack as rows, singles wrap below */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
        <div
          ref={chestRef}
          data-testid="chest"
          style={{
            flex: 1,
            minHeight: '170px',
            background: 'var(--wood)',
            border: '6px solid var(--dirt-dark)',
            borderRadius: 'var(--radius)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          <TargetSign value={target} />
          {placedRods.map(chestItem)}
          {Array.from({ length: rodSlots }, (_, i) => (
            <div
              key={`rodslot-${i}`}
              style={{
                width: `${ROD_W}px`,
                height: `${SEG + 8}px`,
                borderRadius: '8px',
                border: '3px dashed rgba(255,255,255,0.7)',
              }}
            />
          ))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {placedSingles.map(chestItem)}
            {Array.from({ length: singleSlots }, (_, i) => (
              <div
                key={`slot-${i}`}
                style={{
                  width: `${CHEST_SINGLE}px`,
                  height: `${CHEST_SINGLE}px`,
                  borderRadius: '4px',
                  border: '3px dashed rgba(255,255,255,0.7)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Submit: big friendly check, no text */}
        <button
          onClick={submit}
          disabled={placed.length === 0 || demoing || submitted}
          style={{
            width: 'calc(var(--tap-target) * 1.4)',
            borderRadius: 'var(--radius)',
            background: placed.length > 0 && !demoing ? 'var(--good)' : '#c9d4cd',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background var(--anim-fast)',
          }}
          aria-label="Færdig"
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12.5 L9.5 18 L20 6.5"
              stroke="white"
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Floating item that follows the finger */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: `${drag.x - (isRod(drag.key) ? ROD_W / 2 : SINGLE / 2)}px`,
            top: `${drag.y - SINGLE / 2}px`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {isRod(drag.key) ? (
            <TenRod blockType={blockType} highlight />
          ) : (
            <Block type={blockType} size={SINGLE} highlight />
          )}
        </div>
      )}
    </div>
  )
}

export const tensAndOnes: TaskTemplate<TensAndOnesData> = {
  id: 'tens-and-ones',
  generateTrial,
  applyScaffold,
  View,
}
