import { useEffect, useState } from 'preact/hooks'
import skillsJson from '../data/skills.json'
import type { Domain, Skill } from '../engine/types'
import { loadActiveTrials, profile } from '../state/store'
import { sessionSeries, type SessionPoint } from './trendData'

const skills = skillsJson as Skill[]

const DOMAIN_COLORS: Record<Domain, string> = {
  subitizing: '#4a90d9',
  patterns: '#8a6fc9',
  counting: '#5da460',
  numeral: '#c9781f',
  magnitude: '#c05a8e',
  ordering: '#3aa6a0',
  addsub: '#b04a3c',
}

const W = 640
const H = 240
const PAD = { l: 40, r: 12, t: 12, b: 26 }

function xPos(i: number, n: number): number {
  if (n <= 1) return PAD.l + (W - PAD.l - PAD.r) / 2
  return PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1)
}

/** Success-rate chart: one line per domain plus the overall line. */
function SuccessChart({ points }: { points: SessionPoint[] }) {
  const domains = [...new Set(points.flatMap((p) => Object.keys(p.byDomain)))] as Domain[]
  const yPos = (rate: number) => PAD.t + (1 - rate) * (H - PAD.t - PAD.b)

  const seriesFor = (getStat: (p: SessionPoint) => { clean: number; total: number } | undefined) =>
    points
      .map((p, i) => ({ i, stat: getStat(p) }))
      .filter((e) => e.stat && e.stat.total > 0)
      .map((e) => ({ x: xPos(e.i, points.length), y: yPos(e.stat!.clean / e.stat!.total) }))

  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: '760px', display: 'block' }}>
      {[0, 0.5, 0.8, 1].map((r) => (
        <g key={r}>
          <line x1={PAD.l} y1={yPos(r)} x2={W - PAD.r} y2={yPos(r)} stroke="rgba(46,58,63,0.12)" stroke-dasharray={r === 0.8 ? '4 3' : undefined} />
          <text x={PAD.l - 6} y={yPos(r) + 4} text-anchor="end" font-size="10" fill="#5b6a70">
            {Math.round(r * 100)}%
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <text key={p.sessionId} x={xPos(i, points.length)} y={H - 8} text-anchor="middle" font-size="10" fill="#5b6a70">
          {new Date(p.start).toLocaleDateString('da-DK', { day: 'numeric', month: 'numeric' })}
        </text>
      ))}
      {domains.map((d) => {
        const pts = seriesFor((p) => p.byDomain[d])
        return (
          <g key={d}>
            {pts.length > 1 && <path d={line(pts)} fill="none" stroke={DOMAIN_COLORS[d]} stroke-width="2" opacity="0.75" />}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill={DOMAIN_COLORS[d]} />
            ))}
          </g>
        )
      })}
      {(() => {
        const pts = seriesFor((p) => p.overall)
        return (
          <g>
            {pts.length > 1 && <path d={line(pts)} fill="none" stroke="#2e3a3f" stroke-width="2.5" />}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#2e3a3f" />
            ))}
          </g>
        )
      })()}
    </svg>
  )
}

function TimeChart({ points }: { points: SessionPoint[] }) {
  const vals = points.filter((p) => p.medianMs !== null)
  if (vals.length === 0) return null
  const max = Math.max(...vals.map((p) => p.medianMs!), 5000)
  const yPos = (ms: number) => PAD.t + (1 - ms / max) * (H - PAD.t - PAD.b)
  const pts = points
    .map((p, i) => ({ i, ms: p.medianMs }))
    .filter((e) => e.ms !== null)
    .map((e) => ({ x: xPos(e.i, points.length), y: yPos(e.ms!) }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: '760px', display: 'block' }}>
      {[0, max / 2, max].map((ms) => (
        <g key={ms}>
          <line x1={PAD.l} y1={yPos(ms)} x2={W - PAD.r} y2={yPos(ms)} stroke="rgba(46,58,63,0.12)" />
          <text x={PAD.l - 6} y={yPos(ms) + 4} text-anchor="end" font-size="10" fill="#5b6a70">
            {(ms / 1000).toFixed(0)}s
          </text>
        </g>
      ))}
      {pts.length > 1 && (
        <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="#4a90d9" stroke-width="2.5" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#4a90d9" />
      ))}
      {points.map((p, i) => (
        <text key={p.sessionId} x={xPos(i, points.length)} y={H - 8} text-anchor="middle" font-size="10" fill="#5b6a70">
          {new Date(p.start).toLocaleDateString('da-DK', { day: 'numeric', month: 'numeric' })}
        </text>
      ))}
    </svg>
  )
}

export function Trends() {
  const p = profile.value!
  const [points, setPoints] = useState<SessionPoint[] | null>(null)
  useEffect(() => {
    void loadActiveTrials().then((ts) => setPoints(sessionSeries(ts, skills)))
  }, [p.id])

  if (points === null) return <div>Loading…</div>
  if (points.length === 0) return <div style={{ color: 'var(--ink-soft)' }}>No sessions yet.</div>

  const domains = [...new Set(points.flatMap((pt) => Object.keys(pt.byDomain)))] as Domain[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ marginBottom: '4px' }}>First-try success per session</h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: '8px' }}>
          Unassisted first attempts only. The dashed line is the ~80% comfort target; black is
          overall, colors are per skill area.
        </div>
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '10px', boxShadow: 'var(--shadow)' }}>
          <SuccessChart points={points} />
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2e3a3f' }} /> overall
          </span>
          {domains.map((d) => (
            <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: DOMAIN_COLORS[d] }} />
              {d}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '4px' }}>Thinking time</h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: '8px' }}>
          Median response time of correct first-try answers. Falling = fluency growing; a jump
          usually means new, harder material arrived (that's fine).
        </div>
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '10px', boxShadow: 'var(--shadow)' }}>
          <TimeChart points={points} />
        </div>
      </div>
    </div>
  )
}
