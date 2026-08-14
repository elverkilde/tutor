import { useState } from 'preact/hooks'
import { Overview } from './Overview'
import { Settings } from './Settings'
import { SkillMap } from './SkillMap'
import { Trends } from './Trends'

const TABS = [
  ['overview', 'Overview'],
  ['map', 'Skill map'],
  ['trends', 'Trends'],
  ['settings', 'Settings'],
] as const
type Tab = (typeof TABS)[number][0]

/** The adult-facing area: dashboard + settings. English on purpose — it's for the tutor. */
export function AdultScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')

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
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              background: tab === id ? 'var(--ink)' : 'transparent',
              color: tab === id ? 'white' : 'var(--ink)',
            }}
          >
            {label}
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
        {tab === 'overview' && <Overview />}
        {tab === 'map' && <SkillMap />}
        {tab === 'trends' && <Trends />}
        {tab === 'settings' && <Settings onProfileReset={onClose} />}
      </div>
    </div>
  )
}
