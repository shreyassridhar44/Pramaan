import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'

import { RosetteMark } from '@/components/security/guilloche'
import type { components } from '@/lib/api/schema'
import { formatCount, formatINRCompact } from '@/lib/format'

import { polar as polarAt, sector as sectorAt } from './geom'
import { RIVER_BANDS, bandValue } from './river-bands'

type Month = components['schemas']['RiverWeek']

const SIZE = 560
const C = SIZE / 2
const R0 = 118
const SPAN = 132
const GAP = 1.6

const polar = (r: number, deg: number) => polarAt(C, C, r, deg)
const sector = (r1: number, r2: number, a1: number, a2: number) => sectorAt(C, C, r1, r2, a1, a2)

// Bank-confirmed sits nearest the centre, declared at the edge: the outer rim is the risk.
const ORDER = [2, 1, 0] as const
const FILL = ['var(--chart-a0)', 'var(--chart-a1)', 'var(--chart-a2)']

/**
 * The maturity clock: the next 24 months around a dial, starting at the as-of month at twelve
 * o'clock. Each petal is the value maturing that month, layered by how well it is proven, with
 * bank-confirmed money at the core and declared money at the rim. The saffron arc marks the next
 * 90 days. Hover a petal to read it; click to list its deposits.
 */
export function MaturityClock({
  months,
  onMonthClick,
}: {
  months: Month[]
  onMonthClick?: (month: string) => void
}) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const n = Math.max(months.length, 24)
  const step = 360 / n
  const totals = months.map((m) => RIVER_BANDS.reduce((s, b) => s + bandValue(m, b.levels), 0))
  const max = Math.max(1, ...totals)
  // Square-root radius so a petal's area, not its length, tracks the value.
  const radius = (v: number) => SPAN * Math.sqrt(v / max)
  const grand = totals.reduce((a, b) => a + b, 0)
  const next90 = totals.slice(0, 3).reduce((a, b) => a + b, 0)
  const ticks = useMemo(() => {
    const t: number[] = []
    for (const crore of [1, 2, 5, 10, 20, 50]) {
      const v = crore * 1e9
      if (v < max) t.push(v)
    }
    return t.slice(-3)
  }, [max])
  const h = hover !== null ? months[hover] : null
  const hTotal = hover !== null ? totals[hover] : 0

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <RosetteMark
        seed="maturity-clock"
        className="spin-slower pointer-events-none absolute inset-[6%]"
        color="var(--guilloche-soft)"
      />
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="group"
        aria-label={`Maturity clock: ${formatINRCompact(grand)} maturing over the next 24 months, ${formatINRCompact(next90)} in the next 90 days`}
        className="relative w-full"
        onMouseLeave={() => setHover(null)}
      >
        {/* Value rings */}
        {ticks.map((v) => (
          <g key={v}>
            <circle
              cx={C}
              cy={C}
              r={R0 + radius(v)}
              fill="none"
              stroke="var(--line-strong)"
              strokeDasharray="2 5"
            />
            <text
              x={C + 4}
              y={C - R0 - radius(v) - 4}
              fontSize="10"
              fill="var(--ink-3)"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {formatINRCompact(v)}
            </text>
          </g>
        ))}
        {/* The next 90 days */}
        <path
          d={sector(R0 - 12, R0 - 5, GAP / 2, 3 * step - GAP / 2)}
          fill="var(--saffron)"
          opacity="0.9"
        />
        {/* Petals */}
        {months.map((m, i) => {
          const a1 = i * step + GAP / 2
          const a2 = (i + 1) * step - GAP / 2
          const total = totals[i] || 1
          const full = radius(totals[i] ?? 0)
          let cum = 0
          const layers = ORDER.map((band) => {
            const r1 = R0 + (full * cum) / total
            cum += bandValue(m, RIVER_BANDS[band].levels)
            return { band, d: sector(r1, R0 + (full * cum) / total, a1, a2) }
          })
          const dim = hover !== null && hover !== i
          return (
            <motion.g
              key={m.week}
              initial={reduce ? false : { scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: dim ? 0.28 : 1 }}
              transition={{
                scale: {
                  type: 'spring',
                  stiffness: 160,
                  damping: 18,
                  delay: reduce ? 0 : i * 0.035,
                },
                opacity: { duration: 0.2 },
              }}
              style={{
                transformOrigin: `${C}px ${C}px`,
                cursor: onMonthClick ? 'pointer' : undefined,
              }}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => onMonthClick?.(m.week)}
              tabIndex={onMonthClick ? 0 : undefined}
              role={onMonthClick ? 'button' : undefined}
              aria-label={`${new Date(m.week).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}: ${formatINRCompact(totals[i]!)} in ${m.count} deposits`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onMonthClick?.(m.week)
              }}
            >
              {/* Hit area spans the full petal length so thin months are easy to hover. */}
              <path d={sector(R0, R0 + SPAN + 6, a1, a2)} fill="transparent" />
              {layers.map((l) => (
                <path
                  key={l.band}
                  d={l.d}
                  fill={FILL[l.band]}
                  stroke="var(--surface)"
                  strokeWidth="1"
                />
              ))}
            </motion.g>
          )
        })}
        {/* Month labels */}
        {months.map((m, i) => {
          const d = new Date(m.week)
          const [x, y] = polar(R0 + SPAN + 22, (i + 0.5) * step)
          const jan = d.getMonth() === 0
          return (
            <text
              key={m.week}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={jan ? 11 : 10}
              fontWeight={jan || i === 0 ? 600 : 400}
              fill={i === hover ? 'var(--ink)' : jan ? 'var(--ink-2)' : 'var(--ink-3)'}
            >
              {jan ? d.getFullYear() : d.toLocaleDateString('en-IN', { month: 'short' })}
            </text>
          )
        })}
        {/* The as-of hand */}
        <line
          x1={C}
          y1={C - R0 + 4}
          x2={C}
          y2={C - R0 - SPAN - 8}
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle cx={C} cy={C - R0 - SPAN - 10} r="4" fill="var(--accent)" />
        {/* Centre dial */}
        <circle cx={C} cy={C} r={R0 - 18} fill="var(--surface)" stroke="var(--line)" />
        <circle cx={C} cy={C} r={R0 - 24} fill="none" stroke="var(--line)" strokeDasharray="1 3" />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="max-w-[180px] text-center">
          {h ? (
            <>
              <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                {new Date(h.week).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
              <p className="mt-1 font-display text-[2.25rem] leading-none text-ink">
                {formatINRCompact(hTotal ?? 0)}
              </p>
              <p className="mt-1 text-[0.75rem] text-ink-2">{formatCount(h.count)} deposits</p>
              <div className="mt-2 grid gap-0.5 text-left text-[0.6875rem]">
                {[...ORDER].map((b) => (
                  <span key={b} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-ink-3">
                      <span className="size-2 rounded-[2px]" style={{ background: FILL[b] }} />
                      {RIVER_BANDS[b].label}
                    </span>
                    <span className="font-mono text-ink">
                      {formatINRCompact(bandValue(h, RIVER_BANDS[b].levels))}
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                Next 24 months
              </p>
              <p className="mt-1 font-display text-[2.5rem] leading-none text-ink">
                {formatINRCompact(grand)}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] text-ink-2">
                <span className="h-1 w-3 rounded-full bg-saffron" aria-hidden />
                {formatINRCompact(next90)} in 90 days
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
