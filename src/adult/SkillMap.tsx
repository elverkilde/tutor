import skillsJson from '../data/skills.json'
import { effectiveMastery } from '../engine/placement'
import type { MasteryStatus, Skill } from '../engine/types'
import { profile } from '../state/store'
import { layoutSkillMap, NODE_H, NODE_W } from './mapLayout'

const skills = skillsJson as Skill[]

const STATUS_FILL: Record<MasteryStatus, string> = {
  locked: '#e3e7e9',
  frontier: '#bcd7f0',
  practicing: '#f2dfae',
  mastered: '#bfe3c0',
}
const STATUS_STROKE: Record<MasteryStatus, string> = {
  locked: '#c3cacd',
  frontier: '#4a90d9',
  practicing: '#c9a437',
  mastered: '#5da460',
}

/** Split a title into up to two lines that fit the node. */
function twoLines(title: string): [string, string | null] {
  if (title.length <= 20) return [title, null]
  const words = title.split(' ')
  let first = ''
  let i = 0
  while (i < words.length && (first + ' ' + words[i]).trim().length <= 20) {
    first = (first + ' ' + words[i]).trim()
    i++
  }
  const rest = words.slice(i).join(' ')
  return [first, rest.length > 22 ? rest.slice(0, 21) + '…' : rest || null]
}

export function SkillMap() {
  const p = profile.value!
  const mastery = effectiveMastery(p.mastery, p.placement, new Date().toISOString())
  const { nodes, edges, width, height } = layoutSkillMap(skills, mastery)

  return (
    <div>
      <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {(Object.keys(STATUS_FILL) as MasteryStatus[]).map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '4px',
                background: STATUS_FILL[s],
                border: `2px solid ${STATUS_STROKE[s]}`,
              }}
            />
            {s}
          </span>
        ))}
      </div>
      <div style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid rgba(46,58,63,0.1)', borderRadius: '12px', background: 'white' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {edges.map((e, i) => {
            const midX = (e.x1 + e.x2) / 2
            return (
              <path
                key={i}
                d={`M ${e.x1} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="#9aa7ad"
                stroke-width="1.5"
                opacity="0.45"
              />
            )
          })}
          {nodes.map((n) => {
            const [l1, l2] = twoLines(n.title)
            return (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx="10"
                  fill={STATUS_FILL[n.status]}
                  stroke={STATUS_STROKE[n.status]}
                  stroke-width="2"
                />
                <text
                  x={n.x + NODE_W / 2}
                  y={n.y + (l2 ? NODE_H / 2 - 4 : NODE_H / 2 + 4)}
                  text-anchor="middle"
                  font-size="11"
                  font-weight="600"
                  fill="#2e3a3f"
                >
                  {l1}
                </text>
                {l2 && (
                  <text
                    x={n.x + NODE_W / 2}
                    y={n.y + NODE_H / 2 + 12}
                    text-anchor="middle"
                    font-size="11"
                    font-weight="600"
                    fill="#2e3a3f"
                  >
                    {l2}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
