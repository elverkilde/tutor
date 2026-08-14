import { useState } from 'preact/hooks'
import { unlockSfx } from '../audio/sfx'
import { audio, profile } from '../state/store'
import { sleep } from './async'
import { Block } from './Block'
import { AdultGate } from '../adult/Gate'

export function StartScreen({
  onPlay,
  onWorld,
  onAdult,
}: {
  onPlay: () => void
  onWorld: () => void
  onAdult: () => void
}) {
  const [starting, setStarting] = useState(false)

  const start = async () => {
    if (starting) return
    setStarting(true)
    // The tap that starts the game is the gesture that unlocks audio on iOS.
    // Cap the wait: a missing/hung TTS voice must never freeze the button.
    await Promise.race([Promise.all([unlockSfx(), audio.unlock()]), sleep(3500)])
    onPlay()
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '36px',
        position: 'relative',
      }}
    >
      <AdultGate onOpen={onAdult} />

      {/* Which profile is live — so the adult never runs the child on a test
          profile (or tests on his). The child doesn't read, so it's unobtrusive. */}
      <div
        data-testid="active-profile"
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '14px',
          fontSize: '0.9rem',
          color: 'var(--ink-soft)',
          opacity: 0.7,
        }}
      >
        {profile.value?.name}
      </div>
      <div style={{ display: 'flex', gap: '14px' }}>
        <Block type="grass" size={56} />
        <Block type="wood" size={56} />
        <Block type="diamond" size={56} />
        <Block type="stone" size={56} />
      </div>

      <h1 style={{ fontSize: '2.2rem', color: 'var(--ink)', letterSpacing: '0.02em' }}>
        Byg &amp; Tæl
      </h1>

      <button
        onClick={start}
        aria-label="Spil"
        style={{
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: starting ? '#9fceA3' : 'var(--good)',
          boxShadow: '0 6px 0 rgba(46,58,63,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'gentle-pulse calc(2200ms * var(--anim-scale, 1)) ease-in-out infinite',
        }}
      >
        <svg width="72" height="72" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <button
        onClick={onWorld}
        aria-label="Min verden"
        style={{
          width: 'var(--tap-target)',
          height: 'var(--tap-target)',
          borderRadius: 'var(--radius)',
          background: 'var(--card)',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="var(--dirt)">
          <path d="M12 3 3 10h2v10h5v-6h4v6h5V10h2L12 3z" />
        </svg>
      </button>
    </div>
  )
}
