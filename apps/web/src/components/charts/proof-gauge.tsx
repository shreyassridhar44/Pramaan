import { motion, useReducedMotion } from 'motion/react'

import { RosetteMark } from '@/components/security/guilloche'
import { formatPercent } from '@/lib/format'

import { polar, sector } from './geom'

const W = 360
const CX = 180
const CY = 190
const R = 150
const T = 26

const SEGMENTS = [
  { key: 'a3', label: 'Re-confirmed', fill: 'var(--a3)' },
  { key: 'a2', label: 'Bank-confirmed', fill: 'var(--chart-a2)' },
  { key: 'a1', label: 'Document-checked', fill: 'var(--chart-a1)' },
  { key: 'a0', label: 'Declared', fill: 'var(--chart-a0)' },
] as const

export type ProofShares = Record<'a0' | 'a1' | 'a2' | 'a3', number>

/**
 * How much of the money is proven, as a meter: the dial runs from re-confirmed through
 * bank-confirmed and document-checked to declared, and the needle stands where bank proof ends.
 */
export function ProofGauge({ shares }: { shares: ProofShares }) {
  const reduce = useReducedMotion()
  const proven = shares.a3 + shares.a2
  const deg = -90 + 180 * proven
  let start = 0
  const arcs = SEGMENTS.map((s) => {
    const a1 = -90 + 180 * start
    start += shares[s.key]
    const a2 = -90 + 180 * start
    return { ...s, d: a2 - a1 > 0.2 ? sector(CX, CY, R - T, R, a1 + 0.4, a2 - 0.4) : null }
  })
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[200px] overflow-hidden">
        <RosetteMark
          seed="proof-gauge"
          className="spin-slower absolute top-[40px] left-1/2 size-[300px] -translate-x-1/2"
          color="var(--guilloche-soft)"
        />
      </div>
      <svg
        viewBox={`-24 0 ${W + 48} 214`}
        className="relative w-full"
        role="img"
        aria-label={`${formatPercent(proven)} of value proven by the issuing bank`}
      >
        <path d={sector(CX, CY, R - T, R, -90, 90)} fill="var(--surface-sunken)" />
        {arcs.map((a, i) =>
          a.d ? (
            <motion.path
              key={a.key}
              d={a.d}
              fill={a.fill}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.15 * i, duration: 0.4 }}
            />
          ) : null,
        )}
        {Array.from({ length: 21 }, (_, i) => {
          const d = -90 + 9 * i
          const [x1, y1] = polar(CX, CY, R + 4, d)
          const [x2, y2] = polar(CX, CY, R + (i % 5 === 0 ? 14 : 9), d)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--ink-3)"
              strokeWidth={i % 5 === 0 ? 1.5 : 0.8}
            />
          )
        })}
        {[0, 50, 100].map((v) => {
          const [x, y] = polar(CX, CY, R + 26, -90 + 1.8 * v)
          return (
            <text
              key={v}
              x={x}
              y={y + 3}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-3)"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {v}%
            </text>
          )
        })}
        <motion.g
          initial={reduce ? false : { rotate: -90 }}
          animate={{ rotate: deg }}
          transition={{ type: 'spring', stiffness: 60, damping: 11, delay: reduce ? 0 : 0.4 }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        >
          <path
            d={`M${CX - 7} ${CY - R - 10} L${CX} ${CY - R + T + 6} L${CX + 7} ${CY - R - 10} Z`}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        </motion.g>
        <text
          x={CX}
          y={CY - 30}
          textAnchor="middle"
          fontSize="46"
          fill="var(--a2)"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formatPercent(proven)}
        </text>
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
          proven by the issuing bank
        </text>
        <circle
          cx={CX}
          cy={CY}
          r="11"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="3"
        />
      </svg>
      <ul className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[0.75rem]">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.fill }} aria-hidden />
            <span className="flex-1 text-ink-2">{s.label}</span>
            <span className="font-mono text-ink">{formatPercent(shares[s.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
