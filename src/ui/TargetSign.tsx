/** The wooden sign showing the target numeral (used by chest and tower). */
export function TargetSign({ value }: { value: number }) {
  return (
    <div
      data-testid="target"
      style={{
        position: 'absolute',
        top: '-26px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--paper)',
        border: '4px solid var(--dirt-dark)',
        borderRadius: '12px',
        padding: '2px 22px',
        fontSize: '2.2rem',
        fontWeight: 800,
        zIndex: 1,
      }}
    >
      {value}
    </div>
  )
}
