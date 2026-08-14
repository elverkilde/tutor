import { useEffect, useRef, useState } from 'preact/hooks'
import { BLOCKS, blockById } from '../data/blocks'
import { worldSizeFor } from '../engine/world'
import { audio, profile, updateProfile } from '../state/store'
import { sfx } from '../audio/sfx'
import { Block } from './Block'

const DRAG_THRESHOLD = 12

/**
 * The persistent build-world. Tap a tray block type, tap a cell to place it.
 * Placed blocks are moved by DRAGGING — to another cell to rearrange, or off
 * the grid (e.g. down to the tray) to take them back. Taps on placed blocks
 * do nothing destructive: his world stays safe to touch.
 */
export function RewardWorldScreen({ onDone }: { onDone: () => void }) {
  const p = profile.value!
  const firstOwned = BLOCKS.find((b) => (p.inventory[b.id] ?? 0) > 0)?.id ?? null
  const [selected, setSelected] = useState<string | null>(firstOwned)
  const [drag, setDrag] = useState<{ x: number; y: number; fromX: number; fromY: number; block: string } | null>(null)
  const press = useRef<{ x: number; y: number; x0: number; y0: number; moved: boolean; block: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Learning grows the world: check for expansion on entering build time.
  useEffect(() => {
    const masteredCount = Object.values(p.mastery).filter((m) => m.masteredAt).length
    const size = worldSizeFor(masteredCount)
    if (size.cols > p.world.cols || size.rows > p.world.rows) {
      updateProfile((prof) => ({
        ...prof,
        world: {
          ...prof.world,
          cols: Math.max(prof.world.cols, size.cols),
          rows: Math.max(prof.world.rows, size.rows),
        },
      }))
      void audio.speak({ key: 'worldBigger' })
    }
  }, [])

  const cellMap = new Map(p.world.cells.map((c) => [`${c.x},${c.y}`, c.block]))

  /** Which grid cell is under this pointer position? null = outside the grid. */
  const cellAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const r = gridRef.current?.getBoundingClientRect()
    if (!r) return null
    const pad = 8
    const gap = 3
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null
    const cellW = (r.width - 2 * pad - (p.world.cols - 1) * gap) / p.world.cols
    const cellH = (r.height - 2 * pad - (p.world.rows - 1) * gap) / p.world.rows
    const x = Math.floor((clientX - r.left - pad) / (cellW + gap))
    const y = Math.floor((clientY - r.top - pad) / (cellH + gap))
    if (x < 0 || x >= p.world.cols || y < 0 || y >= p.world.rows) return null
    return { x, y }
  }

  const placeFromTray = (x: number, y: number) => {
    if (!selected || (p.inventory[selected] ?? 0) <= 0) return
    sfx.place()
    updateProfile((prof) => ({
      ...prof,
      inventory: { ...prof.inventory, [selected]: (prof.inventory[selected] ?? 0) - 1 },
      world: { ...prof.world, cells: [...prof.world.cells, { x, y, block: selected }] },
    }))
  }

  const down = (x: number, y: number, block: string) => (e: PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    press.current = { x, y, x0: e.clientX, y0: e.clientY, moved: false, block }
  }
  const move = (e: PointerEvent) => {
    const pr = press.current
    if (!pr) return
    if (!pr.moved && Math.hypot(e.clientX - pr.x0, e.clientY - pr.y0) > DRAG_THRESHOLD) pr.moved = true
    if (pr.moved) setDrag({ x: e.clientX, y: e.clientY, fromX: pr.x, fromY: pr.y, block: pr.block })
  }
  const up = (e: PointerEvent) => {
    const pr = press.current
    press.current = null
    setDrag(null)
    if (!pr || !pr.moved) return // a tap on a placed block does nothing
    const target = cellAt(e.clientX, e.clientY)
    if (target && target.x === pr.x && target.y === pr.y) return
    if (target && !cellMap.has(`${target.x},${target.y}`)) {
      // Move within the world.
      sfx.place()
      updateProfile((prof) => ({
        ...prof,
        world: {
          ...prof.world,
          cells: prof.world.cells.map((c) =>
            c.x === pr.x && c.y === pr.y ? { ...c, x: target.x, y: target.y } : c,
          ),
        },
      }))
    } else if (!target) {
      // Dragged off the grid: back into the inventory.
      updateProfile((prof) => ({
        ...prof,
        inventory: { ...prof.inventory, [pr.block]: (prof.inventory[pr.block] ?? 0) + 1 },
        world: {
          ...prof.world,
          cells: prof.world.cells.filter((c) => !(c.x === pr.x && c.y === pr.y)),
        },
      }))
    }
  }

  const finish = () => {
    void audio.speak({ key: 'sessionDone' })
    onDone()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={finish}
          aria-label="Færdig"
          style={{
            width: 'var(--tap-target)',
            height: 'var(--tap-target)',
            borderRadius: '50%',
            background: 'var(--good)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
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

      {/* The world grid */}
      <div
        ref={gridRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${p.world.cols}, 1fr)`,
          gridTemplateRows: `repeat(${p.world.rows}, 1fr)`,
          gap: '3px',
          background: 'var(--sky-deep)',
          borderRadius: 'var(--radius)',
          padding: '8px',
        }}
      >
        {Array.from({ length: p.world.rows }, (_, y) =>
          Array.from({ length: p.world.cols }, (_, x) => {
            const block = cellMap.get(`${x},${y}`)
            const beingDragged = drag && drag.fromX === x && drag.fromY === y
            return block ? (
              <div
                key={`${x},${y}`}
                class="draggable"
                onPointerDown={down(x, y, block)}
                onPointerMove={move}
                onPointerUp={up}
                style={{
                  animation: 'pop-in var(--anim-fast) ease-out',
                  opacity: beingDragged ? 0.25 : 1,
                }}
              >
                <BlockFill type={block} />
              </div>
            ) : (
              <button
                key={`${x},${y}`}
                onClick={() => placeFromTray(x, y)}
                style={{
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.25)',
                  padding: 0,
                }}
              />
            )
          }),
        )}
      </div>

      {/* Inventory tray */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {BLOCKS.map((b) => {
          const count = p.inventory[b.id] ?? 0
          if (count === 0) return null
          return (
            <button
              key={b.id}
              onClick={() => setSelected(b.id)}
              style={{
                position: 'relative',
                padding: '8px',
                borderRadius: '14px',
                background: 'var(--card)',
                boxShadow: selected === b.id ? '0 0 0 4px var(--focus), var(--shadow)' : 'var(--shadow)',
              }}
            >
              <Block type={b.id} size={48} />
              <div
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  minWidth: '26px',
                  height: '26px',
                  borderRadius: '13px',
                  background: 'var(--ink)',
                  color: 'white',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                }}
              >
                {count}
              </div>
            </button>
          )
        })}
      </div>

      {/* Floating block while dragging */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: `${drag.x - 24}px`,
            top: `${drag.y - 24}px`,
            width: '48px',
            height: '48px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <BlockFill type={drag.block} />
        </div>
      )}
    </div>
  )
}

/** A block that fills its grid cell (unlike Block, which is fixed-size). */
function BlockFill({ type }: { type: string }) {
  const b = blockById.get(type) ?? blockById.get('grass')!
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '4px',
        background: `linear-gradient(180deg, ${b.top} 0%, ${b.top} 30%, ${b.side} 30%, ${b.side} 100%)`,
        boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.15)',
      }}
    />
  )
}
