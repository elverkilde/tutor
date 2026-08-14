import { useState } from 'preact/hooks'
import { Overview } from './Overview'
import { Settings } from './Settings'

/** The adult-facing area: dashboard + settings. English on purpose — it's for the tutor. */
export function AdultScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'settings'>('overview')

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(46,58,63,0.12)',
        }}
      >
        {(['overview', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              background: tab === t ? 'var(--ink)' : 'transparent',
              color: tab === t ? 'white' : 'var(--ink)',
            }}
          >
            {t === 'overview' ? 'Overview' : 'Settings'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ fontSize: '1.6rem', padding: '4px 14px', color: 'var(--ink-soft)' }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        {tab === 'overview' ? <Overview /> : <Settings onProfileReset={onClose} />}
      </div>
    </div>
  )
}
