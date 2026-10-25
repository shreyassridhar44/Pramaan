import { useState } from 'react'

/** A single-series trend line with an end dot and a hover readout. Gaps (null) break the line. */
export function Sparkline({
  points,
  format,
  label,
  width = 180,
  height = 44,
}: {
  points: { label: string; value: number | null }[]
  format: (v: number) => string
  label: string
  width?: number
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const values = points.map((p) => p.value).filter((v): v is number => v != null)
  if (values.length < 2) return <p className="text-[0.75rem] text-ink-3">Not enough data yet</p>
  const pad = 5
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (points.length - 1)
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo || 1)) * (height - 2 * pad)
  const segments: string[] = []
  let current = ''
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current) segments.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`
  })
  if (current) segments.push(current)
  const lastIndex = points.map((p) => p.value != null).lastIndexOf(true)
  const shown = hover ?? lastIndex
  const shownPoint = points[shown]
  return (
    <div className="flex items-end gap-3">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className="overflow-visible"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const i = Math.round(
            ((e.clientX - box.left - pad) / (width - 2 * pad)) * (points.length - 1),
          )
          setHover(points[i]?.value != null ? i : null)
        }}
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad}
          y2={height - pad}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {hover != null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad}
            y2={height - pad}
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
        ) : null}
        {shownPoint?.value != null ? (
          <circle
            cx={x(shown)}
            cy={y(shownPoint.value)}
            r={4}
            fill="var(--brand)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ) : null}
      </svg>
      {shownPoint?.value != null ? (
        <span className="pb-0.5 text-[0.75rem] leading-tight text-ink-2">
          <span className="block font-mono text-ink">{format(shownPoint.value)}</span>
          <span className="block text-ink-3">{shownPoint.label}</span>
        </span>
      ) : null}
    </div>
  )
}
