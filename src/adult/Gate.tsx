import { useRef, useState } from 'preact/hooks'

/**
 * Entry to the adult area: a subtle gear that must be held for 2 seconds.
 * A child tapping it sees a ring start to fill and nothing else happen;
 * releasing resets. Deliberately boring.
 */
const HOLD_MS = 2000

export function AdultGate({ onOpen }: { onOpen: () => void }) {
  const [progress, setProgress] = useState(0)
  const timer = useRef<number | null>(null)

  const stop = () => {
    if (timer.current !== null) {
      clearInterval(timer.current)
      timer.current = null
    }
    setProgress(0)
  }

  const start = (e: PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const t0 = performance.now()
    timer.current = window.setInterval(() => {
      const p = (performance.now() - t0) / HOLD_MS
      if (p >= 1) {
        stop()
        onOpen()
      } else {
        setProgress(p)
      }
    }, 50)
  }

  const r = 16
  const circumference = 2 * Math.PI * r

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      aria-label="Adult area (hold)"
      style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.4,
      }}
    >
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--ink-soft)"
          stroke-width="2"
          stroke-dasharray={circumference}
          stroke-dashoffset={circumference * (1 - progress)}
          transform="rotate(-90 22 22)"
        />
        <g fill="var(--ink-soft)">
          <circle cx="22" cy="22" r="4" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return (
              <rect
                key={i}
                x={22 + Math.cos(a) * 8 - 1.5}
                y={22 + Math.sin(a) * 8 - 1.5}
                width="3"
                height="3"
              />
            )
          })}
        </g>
      </svg>
    </button>
  )
}
