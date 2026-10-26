import { useId } from 'react'

import { cn } from '@/lib/cn'

const INK = {
  navy: 'var(--brand)',
  green: 'var(--a2)',
  red: 'var(--overdue)',
  copper: 'var(--accent)',
  violet: 'var(--simulated)',
  muted: 'var(--ink-3)',
} as const

export type StampInk = keyof typeof INK

/**
 * A rubber stamp: double border, uppercase legend, a date line, and slightly uneven ink. Used for
 * lifecycle steps, the way an office marks a file as it moves.
 */
export function RubberStamp({
  title,
  sub,
  date,
  ink = 'navy',
  shape = 'rect',
  rotate = -4,
  stamp = false,
  className,
}: {
  title: string
  sub?: string
  date?: string
  ink?: StampInk
  shape?: 'rect' | 'circle'
  rotate?: number
  stamp?: boolean
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const color = INK[ink]
  const w = shape === 'circle' ? 150 : 210
  const h = shape === 'circle' ? 150 : 104
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={[title, sub, date].filter(Boolean).join(', ')}
      className={cn('overflow-visible', stamp && 'stamp-in', className)}
      style={{ ['--stamp-rotate' as string]: `${rotate}deg`, transform: stamp ? undefined : `rotate(${rotate}deg)` }}
    >
      <defs>
        <filter id={`ink-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" result="rough" />
          <feComponentTransfer in="noise" result="holes">
            <feFuncA type="discrete" tableValues="1 1 1 1 0.35 1 1 1" />
          </feComponentTransfer>
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#ink-${id})`} fill={color} stroke={color} opacity="0.88">
        {shape === 'circle' ? (
          <>
            <circle cx="75" cy="75" r="71" fill="none" strokeWidth="4" />
            <circle cx="75" cy="75" r="63" fill="none" strokeWidth="1.5" />
            <text x="75" y="70" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="1.5" stroke="none">
              {title.toUpperCase()}
            </text>
            {sub ? (
              <text x="75" y="88" textAnchor="middle" fontSize="9.5" letterSpacing="1" stroke="none">
                {sub.toUpperCase()}
              </text>
            ) : null}
            {date ? (
              <text x="75" y="106" textAnchor="middle" fontSize="9" stroke="none" style={{ fontFamily: 'var(--font-mono)' }}>
                {date}
              </text>
            ) : null}
          </>
        ) : (
          <>
            <rect x="3" y="3" width={w - 6} height={h - 6} rx="8" fill="none" strokeWidth="4" />
            <rect x="11" y="11" width={w - 22} height={h - 22} rx="4" fill="none" strokeWidth="1.5" />
            <text x={w / 2} y={sub ? 48 : 60} textAnchor="middle" fontSize="20" fontWeight="800" letterSpacing="2" stroke="none">
              {title.toUpperCase()}
            </text>
            {sub ? (
              <text x={w / 2} y="68" textAnchor="middle" fontSize="10" letterSpacing="1.2" stroke="none">
                {sub.toUpperCase()}
              </text>
            ) : null}
            {date ? (
              <text x={w / 2} y="85" textAnchor="middle" fontSize="10" stroke="none" style={{ fontFamily: 'var(--font-mono)' }}>
                {date}
              </text>
            ) : null}
          </>
        )}
      </g>
    </svg>
  )
}
