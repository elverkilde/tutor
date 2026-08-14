/**
 * The visual schedule: one pip per game round, filled as rounds finish.
 * Predictability ("how much is left?") matters a lot for this child.
 */
export function ProgressPips({ total, done }: { total: number; done: number }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: i < done ? 'var(--good)' : 'rgba(46,58,63,0.15)',
            transition: 'background var(--anim-slow)',
          }}
        />
      ))}
    </div>
  )
}
