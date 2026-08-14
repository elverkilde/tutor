import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { TargetSign } from '../../ui/TargetSign'
import { sleep } from '../../ui/async'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'
import { rangeOf } from '../types'

export interface TowerBuildData {
  target: number
  blockType: string
  /** scaffold 1: ghost outline of the finished tower */
  showGhost: boolean
}

const BLOCK_CHOICES = ['grass', 'stone', 'wood', 'brick']
const SIZE = 36
const DRAG_THRESHOLD = 12

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<TowerBuildData> {
  const rng = mulberry32(seed)
  const [min, max] = rangeOf(params)
  const target = rng.int(min, max)
  return {
    templateId: 'tower-build',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'buildTower', n: target },
    data: { target, blockType: rng.pick(BLOCK_CHOICES), showGhost: false },
  }
}

function applyScaffold(spec: TrialSpec<TowerBuildData>, level: 0 | 1 | 2): TrialSpec<TowerBuildData> {
  if (level === 0) return spec
  return { ...spec, data: { ...spec.data, showGhost: true } }
}

/**
 * Taps never destroy: tapping tower blocks counts them aloud with numbered
 * badges. Removing a block = dragging the TOP block off the tower (you can't
 * pull a block out of the middle of a real tower either).
 */
function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<TowerBuildData>) {
  const { target, blockType, showGhost } = spec.data
  const [height, setHeight] = useState(0)
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const press = useRef<{ level: number; x0: number; y0: number; moved: boolean } | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      for (let i = 1; i <= target; i++) {
        if (!alive.current) return
        setHeight(i)
        await speak({ key: 'number', n: i })
        await sleep(220)
      }
      await sleep(1100)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const addBlock = () => {
    if (demoing || submitted || height >= 20) return
    setHeight((h) => h + 1)
    setCounts({})
  }

  const tapCount = (level: number) => {
    setCounts((prev) => {
      if (prev[level] !== undefined) {
        void speak({ key: 'number', n: 1 })
        return { [level]: 1 }
      }
      const next = Object.keys(prev).length + 1
      void speak({ key: 'number', n: next })
      return { ...prev, [level]: next }
    })
  }

  const down = (level: number) => (e: PointerEvent) => {
    if (demoing || submitted) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    press.current = { level, x0: e.clientX, y0: e.clientY, moved: false }
  }
  const moveP = (e: PointerEvent) => {
    const p = press.current
    if (!p) return
    const isTop = p.level === height - 1
    if (!p.moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > DRAG_THRESHOLD) p.moved = true
    if (p.moved && isTop) setDrag({ x: e.clientX, y: e.clientY })
  }
  const upP = (e: PointerEvent) => {
    const p = press.current
    press.current = null
    setDrag(null)
    if (!p || demoing || submitted) return
    const isTop = p.level === height - 1
    if (!p.moved) {
      tapCount(p.level)
    } else if (isTop) {
      const r = plotRef.current?.getBoundingClientRect()
      const inside = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!inside) {
        setHeight((h) => Math.max(0, h - 1))
        setCounts({})
      }
    }
  }

  const submit = () => {
    if (demoing || submitted || height === 0) return
    setSubmitted(true)
    onResponse({ correct: height === target })
  }

  const ghostCount = showGhost ? Math.max(target, height) : height
  const latestCount = Object.keys(counts).length

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px' }}>
      {/* Supply: one big source pile, tap to add a block to the tower */}
      <button
        data-testid="supply"
        onClick={addBlock}
        style={{
          flex: 1,
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${SIZE}px)`, gap: '8px' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} type={blockType} size={SIZE} />
          ))}
        </div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M12 4v16M12 4l-5 5M12 4l5 5" stroke="var(--ink-soft)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      {/* The tower plot */}
      <div
        ref={plotRef}
        style={{
          flex: 1,
          position: 'relative',
          background: 'var(--sky-deep)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'center',
          padding: '12px',
          gap: '2px',
          overflow: 'visible',
        }}
      >
        <TargetSign value={target} />
        <div style={{ width: '70%', height: '8px', background: 'var(--dirt-dark)', borderRadius: '3px' }} />
        {Array.from({ length: ghostCount }, (_, i) => {
          if (i >= height) {
            return (
              <div
                key={`ghost-${i}`}
                style={{
                  width: `${SIZE}px`,
                  height: `${SIZE}px`,
                  borderRadius: '4px',
                  border: '3px dashed rgba(255,255,255,0.7)',
                }}
              />
            )
          }
          const badge = counts[i]
          return (
            <div
              key={`b-${i}`}
              data-tower-block
              class="draggable"
              onPointerDown={down(i)}
              onPointerMove={moveP}
              onPointerUp={upP}
              style={{
                position: 'relative',
                animation: 'pop-in var(--anim-fast) ease-out',
                opacity: drag && i === height - 1 ? 0.25 : 1,
              }}
            >
              <Block type={blockType} size={SIZE} highlight={badge !== undefined && badge === latestCount} />
              {badge !== undefined && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-7px',
                    right: '-13px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--focus)',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  {badge}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={height === 0 || demoing || submitted}
        aria-label="Færdig"
        style={{
          width: 'calc(var(--tap-target) * 1.2)',
          borderRadius: 'var(--radius)',
          background: height > 0 && !demoing ? 'var(--good)' : '#c9d4cd',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--anim-fast)',
        }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5 L9.5 18 L20 6.5" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      {/* Floating block while dragging the top block off */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: `${drag.x - SIZE / 2}px`,
            top: `${drag.y - SIZE / 2}px`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <Block type={blockType} size={SIZE} highlight />
        </div>
      )}
    </div>
  )
}

export const towerBuild: TaskTemplate<TowerBuildData> = {
  id: 'tower-build',
  generateTrial,
  applyScaffold,
  View,
}
