import { useEffect, useState } from 'preact/hooks'
import skillsJson from '../data/skills.json'
import { deriveStatus } from '../engine/mastery'
import { effectiveMastery } from '../engine/placement'
import type { Domain, MasteryStatus, Skill, Trial } from '../engine/types'
import { loadActiveTrials, profile } from '../state/store'
import { buildSuggestions } from './suggestions'

const skills = skillsJson as Skill[]

const STATUS_STYLE: Record<MasteryStatus, { label: string; bg: string }> = {
  locked: { label: 'locked', bg: '#d7dcde' },
  frontier: { label: 'ready', bg: '#bcd7f0' },
  practicing: { label: 'practicing', bg: '#f2dfae' },
  mastered: { label: 'mastered', bg: '#bfe3c0' },
}

const DOMAIN_LABEL: Partial<Record<Domain, string>> = {
  subitizing: 'Subitizing (seeing amounts)',
  counting: 'Counting',
  numeral: 'Digits ↔ quantities',
  magnitude: 'More / fewer',
  ordering: 'Ordering & number line',
  addsub: 'Addition & subtraction',
  patterns: 'Patterns',
}

interface SessionSummary {
  sessionId: string
  start: string
  attempts: number
  clean: number
  scaffolded: number
  demonstrated: number
  placementProbes: number
}

function summarize(trials: Trial[]): SessionSummary[] {
  const bySession = new Map<string, Trial[]>()
  for (const t of trials) {
    bySession.set(t.sessionId, [...(bySession.get(t.sessionId) ?? []), t])
  }
  return [...bySession.values()]
    .map((ts) => ({
      sessionId: ts[0].sessionId,
      start: ts.reduce((min, t) => (t.ts < min ? t.ts : min), ts[0].ts),
      attempts: ts.length,
      clean: ts.filter((t) => t.outcome === 'correct' && t.scaffoldLevel === 0).length,
      scaffolded: ts.filter((t) => t.outcome === 'correct' && t.scaffoldLevel > 0).length,
      demonstrated: ts.filter((t) => t.outcome === 'demonstrated').length,
      placementProbes: ts.filter((t) => t.mode === 'placement').length,
    }))
    .sort((a, b) => b.start.localeCompare(a.start))
}

function WindowDots({ skillId }: { skillId: string }) {
  const state = profile.value?.mastery[skillId]
  if (!state || state.window.length === 0) return <span style={{ color: 'var(--ink-soft)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', gap: '3px' }}>
      {state.window.map((e, i) => {
        const color =
          e.outcome === 'correct' && e.scaffoldLevel === 0
            ? 'var(--good)'
            : e.outcome === 'correct'
              ? '#e0b64f'
              : '#d99a94'
        return (
          <span
            key={i}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: e.outcome === 'demonstrated' ? 'transparent' : color,
              border: e.outcome === 'demonstrated' ? '2px solid #d99a94' : 'none',
            }}
          />
        )
      })}
    </span>
  )
}

export function Overview() {
  const p = profile.value!
  const mastery = effectiveMastery(p.mastery, p.placement, new Date().toISOString())
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  useEffect(() => {
    void loadActiveTrials().then((ts) => setSessions(summarize(ts)))
  }, [p.id])

  const domains = [...new Set(skills.map((s) => s.domain))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* What deserves attention right now */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow)',
        }}
      >
        <h3 style={{ marginBottom: '8px' }}>Suggested focus</h3>
        {(() => {
          const suggestions = buildSuggestions(skills, mastery, p.placement, new Date().toISOString())
          if (suggestions.length === 0) {
            return (
              <div style={{ color: 'var(--ink-soft)' }}>
                Nothing urgent — placement is done and practice is balanced. Keep sessions going.
              </div>
            )
          }
          return (
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {suggestions.map((s) => (
                <li key={s.kind}>{s.text}</li>
              ))}
            </ul>
          )
        })()}
      </div>

      {/* Skills by domain */}
      <div>
        <h3 style={{ marginBottom: '10px' }}>Skills</h3>
        {domains.map((d) => (
          <div key={d} style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 600, color: 'var(--ink-soft)', marginBottom: '6px' }}>
              {DOMAIN_LABEL[d] ?? d}
            </div>
            {skills
              .filter((s) => s.domain === d)
              .map((s) => {
                const status = deriveStatus(s, mastery)
                const st = STATUS_STYLE[status]
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'var(--card)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        background: st.bg,
                        borderRadius: '8px',
                        padding: '2px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        minWidth: '86px',
                        textAlign: 'center',
                      }}
                    >
                      {st.label}
                    </span>
                    <span style={{ flex: 1 }}>{s.titleDa}</span>
                    <WindowDots skillId={s.id} />
                  </div>
                )
              })}
          </div>
        ))}
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
          Dots = last attempts: green clean, amber with help, red miss, hollow demonstrated.
          Mastered = ≥85% clean over the last 8.
        </div>
      </div>

      {/* Session history */}
      <div>
        <h3 style={{ marginBottom: '10px' }}>Sessions</h3>
        {sessions === null && <div>Loading…</div>}
        {sessions !== null && sessions.length === 0 && (
          <div style={{ color: 'var(--ink-soft)' }}>No sessions yet.</div>
        )}
        {sessions?.slice(0, 10).map((s) => (
          <div
            key={s.sessionId}
            style={{
              display: 'flex',
              gap: '14px',
              background: 'var(--card)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '6px',
              alignItems: 'baseline',
              flexWrap: 'wrap',
            }}
          >
            <strong>
              {new Date(s.start).toLocaleDateString('da-DK', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              {new Date(s.start).toLocaleTimeString('da-DK', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
            <span>{s.attempts} attempts</span>
            <span style={{ color: 'var(--good)' }}>{s.clean} clean</span>
            {s.scaffolded > 0 && <span style={{ color: '#b28a1f' }}>{s.scaffolded} with help</span>}
            {s.demonstrated > 0 && (
              <span style={{ color: '#a56660' }}>{s.demonstrated} shown</span>
            )}
            {s.placementProbes > 0 && (
              <span style={{ color: 'var(--ink-soft)' }}>({s.placementProbes} placement)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
