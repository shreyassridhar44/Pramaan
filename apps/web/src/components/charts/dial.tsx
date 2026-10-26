import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'

import { polar, sector } from './geom'

const S = 200
const C = 100
const R = 78
const SWEEP = 240

/**
 * An analogue instrument: a 240-degree dial with ticks, a coloured zone for the good range and a
 * needle that swings to the reading. `value` is 0 to 1 along the dial.
 */
export function Dial({
  value,
  reading,
  unit,
  good = 'high',
  label,
}: {
  value: number | null
  reading: string
  unit?: string
  good?: 'high' | 'low'
  label: string
}) {
  const reduce = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const start = -SWEEP / 2
  const v = Math.max(0, Math.min(1, value ?? 0))
  const deg = start + SWEEP * v
  const zone = good === 'high' ? [0.75, 1] : [0, 0.25]
  return (
    <svg
      viewBox={`0 0 ${S} ${S - 24}`}
      role="img"
      aria-label={`${label}: ${reading}${unit ? ` ${unit}` : ''}`}
      className="w-full"
    >
      <defs>
        <radialGradient id={`face-${id}`}>
          <stop offset="0.6" stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--surface-sunken)" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R + 14} fill={`url(#face-${id})`} stroke="var(--line)" />
      <path d={sector(C, C, R - 8, R, start, start + SWEEP)} fill="var(--surface-sunken)" />
      <path
        d={sector(C, C, R - 8, R, start + SWEEP * zone[0]!, start + SWEEP * zone[1]!)}
        fill="var(--a2)"
        opacity="0.75"
      />
      <path
        d={sector(
          C,
          C,
          R - 8,
          R,
          good === 'high' ? start : start + SWEEP * 0.75,
          good === 'high' ? start + SWEEP * 0.25 : start + SWEEP,
        )}
        fill="var(--overdue)"
        opacity="0.45"
      />
      {Array.from({ length: 25 }, (_, i) => {
        const d = start + (SWEEP / 24) * i
        const [x1, y1] = polar(C, C, R + 2, d)
        const [x2, y2] = polar(C, C, R + (i % 6 === 0 ? 10 : 6), d)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--ink-3)"
            strokeWidth={i % 6 === 0 ? 1.4 : 0.7}
          />
        )
      })}
      {value !== null ? (
        <motion.g
          initial={reduce ? false : { rotate: start }}
          animate={{ rotate: deg }}
          transition={{ type: 'spring', stiffness: 50, damping: 9, delay: reduce ? 0 : 0.3 }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          <path d={`M${C - 3} ${C} L${C} ${C - R + 10} L${C + 3} ${C} Z`} fill="var(--accent)" />
        </motion.g>
      ) : null}
      <circle cx={C} cy={C} r="7" fill="var(--ink)" />
      <circle cx={C} cy={C} r="2.5" fill="var(--accent)" />
      <text
        x={C}
        y={C + 34}
        textAnchor="middle"
        fontSize="24"
        fill="var(--ink)"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {reading}
      </text>
      {unit ? (
        <text
          x={C}
          y={C + 48}
          textAnchor="middle"
          fontSize="9"
          fill="var(--ink-3)"
          letterSpacing="1"
        >
          {unit.toUpperCase()}
        </text>
      ) : null}
    </svg>
  )
}
