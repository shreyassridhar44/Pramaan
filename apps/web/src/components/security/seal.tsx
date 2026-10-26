import { useId, useMemo } from 'react'

import { cn } from '@/lib/cn'
import { rosetteLayerPaths, rosetteSpec } from '@/lib/guilloche'

const TONE = {
  green: 'var(--a2)',
  navy: 'var(--brand)',
  seal: 'var(--seal)',
  copper: 'var(--accent)',
  muted: 'var(--ink-3)',
  board: 'var(--board-a2)',
} as const

export type SealTone = keyof typeof TONE

/**
 * An embossed office seal: scalloped rim, legend around the edge, a guilloche centre and a
 * tick or short mark. `stamp` presses it in once, like a rubber stamp landing on paper.
 */
export function Seal({
  size = 96,
  tone = 'green',
  legend = 'AICTE Regulation Bureau  •  Pramaan  •  ',
  mark = 'tick',
  seed = 'seal',
  stamp = false,
  label,
  className,
  rotate = -8,
}: {
  size?: number
  tone?: SealTone
  legend?: string
  mark?: 'tick' | string
  seed?: string
  stamp?: boolean
  label?: string
  className?: string
  rotate?: number
}) {
  const id = useId().replace(/:/g, '')
  const color = TONE[tone]
  const rim = useMemo(() => {
    let d = ''
    const n = 240
    for (let i = 0; i <= n; i++) {
      const t = (2 * Math.PI * i) / n
      const r = 95 + 2.4 * Math.sin(56 * t)
      d += `${i ? 'L' : 'M'}${(100 + r * Math.cos(t)).toFixed(1)} ${(100 + r * Math.sin(t)).toFixed(1)}`
    }
    return d + 'Z'
  }, [])
  const centre = useMemo(() => {
    const [outer, inner] = rosetteSpec(seed).layers
    return [
      ...rosetteLayerPaths({ ...outer!, radius: 44, depth: 6, ripple: 3 }, 0.6),
      ...rosetteLayerPaths({ ...inner!, radius: 26, depth: 5, ripple: 2 }, 0.6),
    ]
  }, [seed])
  // Repeat the legend so it always fills the ring.
  const ring = legend.repeat(Math.max(1, Math.ceil(64 / legend.length)))
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 overflow-visible', stamp && 'stamp-in', className)}
      style={{
        ['--stamp-rotate' as string]: `${rotate}deg`,
        transform: stamp ? undefined : `rotate(${rotate}deg)`,
      }}
    >
      <defs>
        <filter id={`emboss-${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow
            dx="-0.8"
            dy="-0.8"
            stdDeviation="0.4"
            floodColor="#fff"
            floodOpacity="0.55"
          />
          <feDropShadow dx="1" dy="1.2" stdDeviation="0.6" floodColor="#000" floodOpacity="0.28" />
        </filter>
        <path id={`ring-${id}`} d="M100 100 m-77 0 a77 77 0 1 1 154 0 a77 77 0 1 1 -154 0" />
      </defs>
      <g filter={`url(#emboss-${id})`}>
        <path d={rim} fill={color} opacity="0.12" />
        <path d={rim} fill="none" stroke={color} strokeWidth="2.2" />
        <circle cx="100" cy="100" r="88" fill="none" stroke={color} strokeWidth="1" />
        <circle cx="100" cy="100" r="64" fill="none" stroke={color} strokeWidth="1.4" />
        <circle cx="100" cy="100" r="60" fill="none" stroke={color} strokeWidth="0.6" />
        <text
          fill={color}
          fontSize="11.5"
          fontWeight="600"
          letterSpacing="2.2"
          style={{ fontFamily: 'var(--font-sans)', textTransform: 'uppercase' }}
        >
          <textPath href={`#ring-${id}`}>{ring}</textPath>
        </text>
        <g fill="none" stroke={color} strokeWidth="0.55" opacity="0.75">
          {centre.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {mark === 'tick' ? (
          <path
            d="M78 101 L94 117 L124 84"
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <text
            x="100"
            y="112"
            textAnchor="middle"
            fill={color}
            fontSize="34"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {mark}
          </text>
        )}
      </g>
    </svg>
  )
}
