import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import type { TemplateParams } from '../../engine/types'
import { Block } from '../../ui/Block'
import { DigitChoices } from '../../ui/DigitChoices'
import { sleep } from '../../ui/async'
import { digitChoicesAround } from '../combine-count'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'

/** Concrete subtraction: a group is shown, some hop away — how many left? */
export interface TakeAwayData {
  start: number
  take: number
  blockType: string
  answer: number
  choices: number[]
}

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<TakeAwayData> {
  const rng = mulberry32(seed)
  const maxStart = typeof params['maxStart'] === 'number' ? params['maxStart'] : 5
  const start = rng.int(3, maxStart)
  const take = rng.int(1, start - 1)
  const answer = start - take
  return {
    templateId: 'take-away',
    skillId,
    params,
    seed,
    promptPhrase: { key: 'takeAway', n: start, n2: take },
    data: {
      start,
      take,
      blockType: rng.pick(['grass', 'stone', 'wood', 'brick']),
      answer,
      choices: digitChoicesAround(answer, 3, maxStart, rng),
    },
  }
}

function applyScaffold(spec: TrialSpec<TakeAwayData>, level: 0 | 1 | 2): TrialSpec<TakeAwayData> {
  if (level === 0 || spec.data.choices.length <= 2) return spec
  const { answer, choices } = spec.data
  const far = [...choices].filter((c) => c !== answer).sort((x, y) => Math.abs(y - answer) - Math.abs(x - answer))[0]
  return { ...spec, data: { ...spec.data, choices: choices.filter((c) => c === answer || c === far) } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<TakeAwayData>) {
  const { start, take, blockType, answer, choices } = spec.data
  const [picked, setPicked] = useState<number | null>(null)
  const [gone, setGone] = useState(0) // how many have hopped away so far
  const [countedUpTo, setCountedUpTo] = useState(-1)
  const [demoDigit, setDemoDigit] = useState<number | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  // The removal plays once on present: blocks hop away one at a time.
  useEffect(() => {
    ;(async () => {
      await sleep(1600) // let the prompt speech get going first
      for (let i = 1; i <= take; i++) {
        if (!alive.current) return
        setGone(i)
        await sleep(420)
      }
    })()
  }, [])

  const demoing = scaffoldLevel === 2
  useEffect(() => {
    if (!demoing) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      setGone(take)
      // Count only the remaining blocks.
      for (let i = 0; i < answer; i++) {
        if (!alive.current) return
        setCountedUpTo(i)
        await speak({ key: 'number', n: i + 1 })
        await sleep(220)
      }
      if (!alive.current) return
      setDemoDigit(answer)
      await sleep(1500)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [demoing])

  const pick = (n: number) => {
    if (picked !== null || demoing) return
    setPicked(n)
    onResponse({ correct: n === answer })
  }

  // The LAST `take` blocks are the ones that leave; remaining stay countable.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', justifyContent: 'center' }}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(start, 5)}, 46px)`,
          gap: '10px',
          justifyContent: 'center',
          alignContent: 'center',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '14px',
        }}
      >
        {Array.from({ length: start }, (_, i) => {
          const leaves = i >= start - take
          const hasLeft = leaves && i - (start - take) < gone
          return (
            <div
              key={i}
              data-remaining={leaves ? 'no' : 'yes'}
              style={{
                opacity: hasLeft ? 0.15 : 1,
                transform: hasLeft ? 'translateY(-14px) rotate(12deg)' : 'none',
                transition: 'opacity var(--anim-slow), transform var(--anim-slow)',
              }}
            >
              <Block type={blockType} size={46} highlight={countedUpTo >= 0 && !leaves && i === countedUpTo} />
            </div>
          )
        })}
      </div>
      <DigitChoices choices={choices} onPick={pick} demoDigit={demoDigit} disabled={demoing || picked !== null} />
    </div>
  )
}

export const takeAway: TaskTemplate<TakeAwayData> = {
  id: 'take-away',
  generateTrial,
  applyScaffold,
  View,
}
