import { blockById } from '../data/blocks'

/** A single Minecraft-ish block: side color with a lighter top face. */
export function Block({
  type = 'grass',
  size = 44,
  highlight = false,
  dimmed = false,
}: {
  type?: string
  size?: number
  highlight?: boolean
  dimmed?: boolean
}) {
  const b = blockById.get(type) ?? blockById.get('grass')!
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '4px',
        background: `linear-gradient(180deg, ${b.top} 0%, ${b.top} 30%, ${b.side} 30%, ${b.side} 100%)`,
        boxShadow: highlight
          ? '0 0 0 4px var(--focus), 0 2px 0 rgba(0,0,0,0.2)'
          : 'inset 0 -3px 0 rgba(0,0,0,0.15), 0 2px 0 rgba(0,0,0,0.12)',
        opacity: dimmed ? 0.25 : 1,
        animation: highlight ? 'gentle-pulse calc(900ms * var(--anim-scale, 1)) ease-in-out infinite' : undefined,
      }}
    />
  )
}

/**
 * A countable pile: rows of up to 5 blocks so quantities stay scannable.
 * highlightIndex marks one block (used by counting demonstrations).
 * With onTapBlock, taps toggle a "counted" dot — one-to-one correspondence
 * support for a child who counts by touching, without revealing the total.
 */
export function BlockPile({
  count,
  type = 'grass',
  size = 44,
  highlightIndex = -1,
  marks,
  onTapBlock,
}: {
  count: number
  type?: string
  size?: number
  highlightIndex?: number
  marks?: Set<number>
  onTapBlock?: (i: number) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(count, 5)}, ${size}px)`,
        gap: '10px',
        justifyContent: 'center',
        alignContent: 'center',
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          onClick={onTapBlock ? () => onTapBlock(i) : undefined}
          style={{ position: 'relative' }}
        >
          <Block type={type} size={size} highlight={i === highlightIndex} />
          {marks?.has(i) && (
            <div
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: `${Math.max(14, size * 0.32)}px`,
                height: `${Math.max(14, size * 0.32)}px`,
                borderRadius: '50%',
                background: 'var(--focus)',
                border: '2px solid white',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
