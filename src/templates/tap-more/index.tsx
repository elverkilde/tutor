import { useEffect, useRef, useState } from 'preact/hooks'
import { mulberry32 } from '../../engine/rng'
import { BlockPile } from '../../ui/Block'
import { sleep } from '../../ui/async'
import type { TemplateParams } from '../../engine/types'
import type { TaskTemplate, TemplateProps, TrialSpec } from '../types'
import { rangeOf } from '../types'

export interface TapMoreData {
  left: number
  right: number
  blockType: string
  /** digits mode: compare bare numerals instead of piles (abstract stage) */
  asDigits: boolean
  /**
   * scaffold 1: show the other representation as a hint — digits under the
   * piles in concrete mode, piles under the digits in abstract mode (CRA).
   */
  hint: boolean
}

const BLOCK_CHOICES = ['grass', 'stone', 'wood', 'dirt']

function generateTrial(skillId: string, params: TemplateParams, seed: number): TrialSpec<TapMoreData> {
  const rng = mulberry32(seed)
  const [min, max] = rangeOf(params)
  const minGap = typeof params['minGap'] === 'number' ? params['minGap'] : 1
  const asDigits = params['asDigits'] === true

  const a = rng.int(min, max - minGap)
  const b = rng.int(a + minGap, max)
  const [left, right] = rng.next() < 0.5 ? [a, b] : [b, a]

  return {
    templateId: 'tap-more',
    skillId,
    params,
    seed,
    promptPhrase: { key: asDigits ? 'tapMoreDigits' : 'tapMore' },
    data: { left, right, blockType: rng.pick(BLOCK_CHOICES), asDigits, hint: false },
  }
}

function applyScaffold(spec: TrialSpec<TapMoreData>, level: 0 | 1 | 2): TrialSpec<TapMoreData> {
  if (level === 0) return spec
  return { ...spec, data: { ...spec.data, hint: true } }
}

function View({ spec, scaffoldLevel, speak, onResponse, onDemoFinished }: TemplateProps<TapMoreData>) {
  const { left, right, blockType, asDigits, hint } = spec.data
  const correctSide = left > right ? 'left' : 'right'
  const [picked, setPicked] = useState<'left' | 'right' | null>(null)
  const [demoTarget, setDemoTarget] = useState<'left' | 'right' | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  useEffect(() => {
    if (scaffoldLevel !== 2) return
    ;(async () => {
      await speak({ key: 'watchMe' })
      if (!alive.current) return
      setDemoTarget(correctSide)
      await sleep(1800)
      if (!alive.current) return
      onDemoFinished()
    })()
  }, [scaffoldLevel])

  const pick = (side: 'left' | 'right') => {
    if (picked || scaffoldLevel === 2) return
    setPicked(side)
    onResponse({ correct: side === correctSide })
  }

  const pile = (side: 'left' | 'right', count: number) => (
    <button
      onClick={() => pick(side)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow:
          demoTarget === side
            ? '0 0 0 5px var(--good), var(--shadow)'
            : 'var(--shadow)',
        padding: '18px',
        minHeight: 'var(--tap-target)',
        animation:
          demoTarget === side
            ? 'gentle-pulse calc(700ms * var(--anim-scale, 1)) ease-in-out infinite'
            : undefined,
      }}
    >
      {asDigits ? (
        <div style={{ fontSize: '4.4rem', fontWeight: 800 }}>{count}</div>
      ) : (
        <BlockPile count={count} type={blockType} />
      )}
      {hint &&
        (asDigits ? (
          <BlockPile count={count} type={blockType} size={26} />
        ) : (
          <div style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--ink-soft)' }}>{count}</div>
        ))}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', alignItems: 'stretch' }}>
      {pile('left', left)}
      {pile('right', right)}
    </div>
  )
}

export const tapMore: TaskTemplate<TapMoreData> = {
  id: 'tap-more',
  generateTrial,
  applyScaffold,
  View,
}
