import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/cn'
import { formatCount, formatINRCompact, formatPercent } from '@/lib/format'

import { PLACE, SHORT } from './region-layout'

type Region = components['schemas']['RegionRow']

const TILE = 58
const MAX_H = 118

/**
 * AICTE regions as an isometric city: each regional office is a tower on a tile placed roughly by
 * geography (a cartogram, no boundaries, DECISION D13). Height is value held; the green share of
 * each tower is the bank-confirmed part; a pulsing beacon marks deposits matured without action.
 * Hover a tower to read it, click to open its registry.
 */
export function IsoIndia({
  regions,
  onSelect,
  overdueOverride,
}: {
  regions: Region[]
  onSelect?: (code: string) => void
  overdueOverride?: Record<string, number>
}) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...regions.map((r) => Number(r.held_paise)))
  const sorted = [...regions].sort((a, b) => {
    // Draw back to front so nearer towers cover farther ones.
    const pa = PLACE[a.code] ?? [0, 0]
    const pb = PLACE[b.code] ?? [0, 0]
    return pa[0] + pa[1] - (pb[0] + pb[1])
  })
  const h = regions.find((r) => r.code === hover)
  const overdue = (r: Region) => overdueOverride?.[r.code] ?? r.overdue
  return (
    <div className="relative">
      <div
        className="relative mx-auto h-[430px] w-full overflow-hidden"
        style={{ perspective: '1600px' }}
        onMouseLeave={() => setHover(null)}
      >
        <div
          className="absolute top-[47%] left-1/2"
          style={{
            width: TILE * 5,
            height: TILE * 6,
            transform: 'translate(-50%, -38%) rotateX(56deg) rotateZ(-40deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* The ground plate */}
          <div
            className="absolute -inset-4 rounded-[18px] border border-line-strong bg-sunken/70"
            style={{ transform: 'translateZ(-1px)' }}
            aria-hidden
          />
          {sorted.map((r, i) => {
            const place = PLACE[r.code]
            if (!place) return null
            const held = Number(r.held_paise)
            const height = 14 + (MAX_H - 14) * Math.sqrt(held / max)
            const conf = held ? Number(r.confirmed_paise) / held : 0
            const lifted = hover === r.code
            const od = overdue(r)
            return (
              <button
                key={r.code}
                type="button"
                aria-label={`${r.name}: ${formatINRCompact(r.held_paise)} held, ${formatPercent(conf)} bank-confirmed, ${od} overdue`}
                onMouseEnter={() => setHover(r.code)}
                onFocus={() => setHover(r.code)}
                onClick={() => onSelect?.(r.code)}
                className="absolute outline-none"
                style={{
                  left: (place[0] - 1) * TILE + 6,
                  top: (place[1] - 1) * TILE + 6,
                  width: TILE - 12,
                  height: TILE - 12,
                  transformStyle: 'preserve-3d',
                }}
              >
                <span
                  className="absolute left-0 block w-[120%] truncate text-left text-[8px] font-semibold tracking-[0.08em] text-ink-2 uppercase"
                  style={{ top: TILE - 10 }}
                  aria-hidden
                >
                  {SHORT[r.code] ?? r.name.split(' Region')[0]}
                </span>
                <motion.span
                  className="absolute inset-0 block"
                  style={{ transformStyle: 'preserve-3d' }}
                  initial={reduce ? false : { z: -height }}
                  animate={{ z: lifted ? 10 : 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 120,
                    damping: 16,
                    delay: reduce ? 0 : i * 0.05,
                  }}
                >
                  <Tower height={height} conf={conf} active={lifted} />
                  {od > 0 ? <Beacon height={height} count={od} /> : null}
                </motion.span>
              </button>
            )
          })}
        </div>
      </div>
      <div
        className="mt-2 min-h-[118px] rounded-[12px] border border-line bg-surface p-3"
        aria-live="polite"
      >
        {h ? (
          <>
            <p className="text-[0.8125rem] font-semibold text-ink">{h.name}</p>
            <p className="text-[0.6875rem] text-ink-3">{h.office_city}</p>
            <p className="mt-2 font-display text-[1.75rem] leading-none text-ink">
              {formatINRCompact(h.held_paise)}
            </p>
            <p className="mt-1 text-[0.6875rem] text-ink-3">
              {formatCount(h.held_count)} deposits held
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-a2"
                style={{
                  width: `${(Number(h.confirmed_paise) / Math.max(1, Number(h.held_paise))) * 100}%`,
                }}
              />
            </div>
            <p className="mt-1 text-[0.6875rem] text-ink-2">
              {formatPercent(Number(h.confirmed_paise) / Math.max(1, Number(h.held_paise)))}{' '}
              bank-confirmed
            </p>
            <p
              className={cn(
                'mt-1 text-[0.6875rem]',
                overdue(h) ? 'font-medium text-overdue' : 'text-ink-3',
              )}
            >
              {overdue(h)} matured without action, {h.discrepancy} discrepancies
            </p>
          </>
        ) : (
          <>
            <p className="text-[0.8125rem] font-semibold text-ink">Eleven regional offices</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-3">
              Tower height is value held, green is the bank-confirmed share, a red beacon means
              deposits matured without action. Hover a tower; click to open its registry.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Tower({ height, conf, active }: { height: number; conf: number; active: boolean }) {
  const w = TILE - 12
  const pct = conf * 100
  // A face rises from the tile edge; its gradient runs from the ground (green, bank-confirmed)
  // to the roof (blue, not yet confirmed by a bank).
  const shade = (dir: string, dark: number) =>
    `linear-gradient(${dir}, color-mix(in srgb, var(--chart-a2) ${100 - dark}%, black) 0 ${pct}%, color-mix(in srgb, var(--chart-a1) ${100 - dark}%, black) ${pct}% 100%)`
  return (
    <>
      <span
        className="absolute block"
        style={{
          left: 0,
          top: w,
          width: w,
          height,
          transformOrigin: 'top',
          transform: 'rotateX(90deg)',
          background: shade('to bottom', 14),
        }}
      />
      <span
        className="absolute block"
        style={{
          left: w,
          top: 0,
          width: height,
          height: w,
          transformOrigin: 'left',
          transform: 'rotateY(-90deg)',
          background: shade('to right', 34),
        }}
      />
      <span
        className={cn('absolute inset-0 block rounded-[2px]', active && 'ring-2 ring-saffron')}
        style={{
          transform: `translateZ(${height}px)`,
          background: conf >= 0.5 ? 'var(--chart-a2)' : 'var(--chart-a1)',
          boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.25)',
        }}
      />
    </>
  )
}

function Beacon({ height, count }: { height: number; count: number }) {
  return (
    <span
      className="absolute inset-0 grid place-items-center"
      style={{ transform: `translateZ(${height + 1}px)`, transformStyle: 'preserve-3d' }}
    >
      <span className="absolute size-9 animate-ping rounded-full bg-overdue/40 motion-reduce:animate-none" />
      <span className="relative grid size-6 place-items-center rounded-full bg-[var(--band-red)] text-[0.625rem] font-bold text-white ring-2 ring-white">
        {count > 99 ? '99+' : count}
      </span>
    </span>
  )
}
