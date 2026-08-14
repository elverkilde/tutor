/**
 * The shared answer row: big digit buttons. Used by every template whose
 * response is "tap the right number" — identical look and placement each
 * time, so the child never has to relearn where answers live.
 */
export function DigitChoices({
  choices,
  onPick,
  demoDigit,
  disabled = false,
}: {
  choices: number[]
  onPick: (n: number) => void
  demoDigit: number | null
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
      {choices.map((n) => (
        <button
          key={n}
          onClick={() => !disabled && onPick(n)}
          style={{
            width: '110px',
            height: '96px',
            fontSize: '3.2rem',
            fontWeight: 800,
            color: 'var(--ink)',
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            boxShadow: demoDigit === n ? '0 0 0 5px var(--good), var(--shadow)' : 'var(--shadow)',
            animation:
              demoDigit === n
                ? 'gentle-pulse calc(700ms * var(--anim-scale, 1)) ease-in-out infinite'
                : undefined,
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
