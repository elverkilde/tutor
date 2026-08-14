import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { TargetSign } from '../../ui/TargetSign'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'
import { rangeOf } from '../types'

export interface DragToChestData {
  target: number
  available: number
  blockType: string
  /** scaffold 1: dashed slots in the chest give one-to-one correspondence support */
  showSlots: boolean
}

const BLOCK_CHOICES = ['grass', 'stone', 'wood', 'dirt']
const BLOCK_SIZE = 52
const DRAG_THRESHOLD = 12

function generateTrial(
  skillId: string,
  params: TemplateParams,
  seed: number,
): TrialSpec<DragToChestData> {
  const rng = mulberry32(seed)
  const [min, max] = rangeOf(params)
  const target = rng.int(min, max)
  // silent: the numeral on the sign is the only clue — pure numeral->quantity production
  const silent = params['silent'] === true
  return {
    templateId: 'drag-to-chest',
    skillId,
    params,
    seed,
    promptPhrase: silent ? { key: 'dragToChestSign' } : { key: 'dragToChest', n: target },
    data: {
      target,
      available: target + rng.int(2, 3),
      blockType: rng.pick(BLOCK_CHOICES),
      showSlots: false,
    },
  }
}

function applyScaffold(
  spec: TrialSpec<DragToChestData>,
  level: 0 | 1 | 2,
): TrialSpec<DragToChestData> {
  if (level === 0) return spec
  return { ...spec, data: { ...spec.data, showSlots: true } }
}

/**
 * Interaction rules (learned from watching the child play): a TAP never
 * destroys anything — tapping a block in the chest counts it aloud with a
 * numbered badge, because touch-counting is exactly the behavior we want to
 * reward. Removal is drag-only: pull a block back out of the chest.
 */
function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<DragToChestData>) {
  const { target, available, blockType, showSlots } = spec.data
  const [placed, setPlaced] = useState<number[]>([])
  /** blockIndex -> count badge (1, 2, 3...) from touch-counting */
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [drag, setDrag] = useState<{ index: number; x: number; y: number; from: 'source' | 'chest' } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const press = useRef<{ index: number; from: 'source' | 'chest'; x0: number; y0: number; moved: boolean } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      for (let i = 0; i < target; i++) {
        if (!alive.current) return
        setPlaced((p) => [...p, i])
        await speak({ key: 'number', n: i + 1 })
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

  const down = (index: number, from: 'source' | 'chest') => (e: PointerEvent) => {
    if (demoing || submitted) return
    if (from === 'source' && placed.includes(index)) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    press.current = { index, from, x0: e.clientX, y0: e.clientY, moved: false }
    // Source blocks drag immediately (the established gesture); chest blocks
    // wait for the movement threshold so a tap stays a tap.
    if (from === 'source') setDrag({ index, x: e.clientX, y: e.clientY, from })
  }

  const move = (e: PointerEvent) => {
    const p = press.current
    if (!p) return
    if (!p.moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > DRAG_THRESHOLD) p.moved = true
    if (p.from === 'source' || p.moved) setDrag({ index: p.index, x: e.clientX, y: e.clientY, from: p.from })
  }

  const up = (e: PointerEvent) => {
    const p = press.current
    press.current = null
    setDrag(null)
    if (!p || demoing || submitted) return
    if (p.from === 'source') {
      if (insideChest(e.clientX, e.clientY)) {
        setPlaced((prev) => (prev.includes(p.index) ? prev : [...prev, p.index]))
        setCounts({})
      }
    } else if (p.moved) {
      if (!insideChest(e.clientX, e.clientY)) {
        setPlaced((prev) => prev.filter((i) => i !== p.index))
        setCounts({})
      }
    } else {
      tapCount(p.index)
    }
  }

  /** Touch-counting: badge each tapped block 1, 2, 3... and say the number. */
  const tapCount = (index: number) => {
    setCounts((prev) => {
      if (prev[index] !== undefined) {
        // Tapping an already-counted block restarts the count from it.
        void speak({ key: 'number', n: 1 })
        return { [index]: 1 }
      }
      const next = Object.keys(prev).length + 1
      void speak({ key: 'number', n: next })
      return { ...prev, [index]: next }
    })
  }

  const submit = () => {
    if (demoing || submitted || placed.length === 0) return
    setSubmitted(true)
    onResponse({ correct: placed.length === target })
  }

  const slotCount = showSlots ? Math.max(target, placed.length) : placed.length
  const latestCount = Object.keys(counts).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Source pile */}
      <div
        style={{
          flex: 1,
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: `repeat(5, ${BLOCK_SIZE}px)`,
          gap: '14px',
          justifyContent: 'center',
          alignContent: 'center',
        }}
      >
        {Array.from({ length: available }, (_, i) => (
          <div
            key={i}
            class="draggable"
            onPointerDown={down(i, 'source')}
            onPointerMove={move}
            onPointerUp={up}
            style={{ visibility: placed.includes(i) ? 'hidden' : 'visible' }}
          >
            <Block type={blockType} size={BLOCK_SIZE} />
          </div>
        ))}
      </div>

      {/* Chest with the target numeral on its sign */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
        <div
          ref={chestRef}
          data-testid="chest"
          style={{
            flex: 1,
            minHeight: '150px',
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
          <TargetSign value={target} />
          {Array.from({ length: slotCount }, (_, s) => {
            const blockIndex = placed[s]
            if (blockIndex === undefined) {
              return (
                <div
                  key={`slot-${s}`}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '4px',
                    border: '3px dashed rgba(255,255,255,0.7)',
                  }}
                />
              )
            }
            const badge = counts[blockIndex]
            const beingDragged = drag?.from === 'chest' && drag.index === blockIndex
            return (
              <div
                key={`b-${blockIndex}`}
                class="draggable"
                onPointerDown={down(blockIndex, 'chest')}
                onPointerMove={move}
                onPointerUp={up}
                style={{
                  position: 'relative',
                  animation: 'pop-in var(--anim-fast) ease-out',
                  opacity: beingDragged ? 0.25 : 1,
                }}
              >
                <Block type={blockType} size={44} highlight={badge !== undefined && badge === latestCount} />
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

      {/* Floating block that follows the finger */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: `${drag.x - BLOCK_SIZE / 2}px`,
            top: `${drag.y - BLOCK_SIZE / 2}px`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <Block type={blockType} size={BLOCK_SIZE} highlight />
        </div>
      )}
    </div>
  )
}

export const dragToChest: TaskTemplate<DragToChestData> = {
  id: 'drag-to-chest',
  generateTrial,
  applyScaffold,
  View,
}
