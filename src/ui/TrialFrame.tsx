import type { ComponentChildren } from 'preact'
import { ProgressPips } from './ProgressPips'

/**
 * The consistent shell around every mini-game: replay-audio button top-left,
 * progress pips top-right, work zone below. Identical on every trial so the
 * child always knows where things are.
 */
export function TrialFrame({
  onReplayAudio,
  totalRounds,
  doneRounds,
  children,
}: {
  onReplayAudio: () => void
  totalRounds: number
  doneRounds: number
  children: ComponentChildren
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onReplayAudio}
          aria-label="Hør igen"
          style={{
            width: 'var(--tap-target)',
            height: 'var(--tap-target)',
            borderRadius: '50%',
            background: 'var(--card)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--ink)">
            <path d="M3 9v6h4l5 4V5L7 9H3z" />
            <path
              d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
              stroke="var(--ink)"
              stroke-width="1.8"
              fill="none"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <ProgressPips total={totalRounds} done={doneRounds} />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  )
}
