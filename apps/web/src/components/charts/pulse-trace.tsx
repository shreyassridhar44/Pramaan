import { useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'

import type { components } from '@/lib/api/schema'
import { formatCount, formatDate } from '@/lib/format'

import { PULSE_SERIES } from './pulse-series'

type Day = components['schemas']['PulseDay']

const W = 1200
const H = 150

/**
 * The portfolio's heartbeat: each kind of recorded event drawn as a trace on a monitor, one
 * point per day. A sweep line passes over it as on an ECG. Hover reads a day.
 */
export function PulseTrace({ days }: { days: Day[] }) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...days.flatMap((d) => PULSE_SERIES.map((s) => d[s.key])))
  const x = (i: number) => (i / Math.max(1, days.length - 1)) * W
  const y = (v: number) => H - 14 - (v / max) * (H - 30)
  const paths = useMemo(
    () =>
      PULSE_SERIES.map((s) => {
        let d = ''
        days.forEach((day, i) => {
          // Each day is a sharp spike from the baseline, like a beat.
          const px = x(i)
          const v = day[s.key]
          d += `${i ? 'L' : 'M'}${(px - 3).toFixed(1)} ${y(0).toFixed(1)}`
          if (v)
            d += `L${px.toFixed(1)} ${y(v).toFixed(1)}L${(px + 3).toFixed(1)} ${y(0).toFixed(1)}`
        })
        return { ...s, d }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- x and y depend only on days and max
    [days, max],
  )
  const h = hover !== null ? days[hover] : null
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[150px] w-full"
        role="img"
        aria-label={`Daily activity over the last ${days.length} days`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.round(((e.clientX - r.left) / r.width) * (days.length - 1))
          setHover(Math.max(0, Math.min(days.length - 1, i)))
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="pulse-grid" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V30" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" />
          </pattern>
          <linearGradient id="pulse-sweep" x1="0" x2="1">
            <stop offset="0" stopColor="var(--saffron)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--saffron)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#pulse-grid)" />
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.12)" />
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth="1.6"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 3px ${p.color})` }}
          />
        ))}
        {!reduce ? (
          <rect width="120" height={H} fill="url(#pulse-sweep)">
            <animate attributeName="x" from="-120" to={W} dur="6s" repeatCount="indefinite" />
          </rect>
        ) : null}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="0"
            y2={H}
            stroke="rgb(255 255 255 / 0.4)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {h ? (
        <div className="pointer-events-none absolute top-2 right-2 rounded-lg bg-black/60 px-3 py-2 text-[0.6875rem] text-board-ink backdrop-blur">
          <p className="font-semibold">{formatDate(h.day)}</p>
          {PULSE_SERIES.map((s) => (
            <p key={s.key} className="flex justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-mono">{formatCount(h[s.key])}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
