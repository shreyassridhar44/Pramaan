import { AlertTriangle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { Tip } from '@/components/ui/primitives'
import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/cn'
import { formatCount, formatINRCompact, formatPercent } from '@/lib/format'

type Region = components['schemas']['RegionRow']

/** Approximate geographic placement on a 5 by 6 grid (column, row). A cartogram, not a map:
 * no boundaries are drawn (DECISION D13). */
const PLACE: Record<string, [number, number]> = {
  north_western: [2, 1],
  northern: [3, 2],
  north_east: [5, 2],
  gujarat: [1, 3],
  central: [2, 3],
  eastern: [4, 3],
  western: [2, 4],
  south_central: [3, 4],
  south_western: [2, 5],
  southern: [3, 5],
  kerala: [2, 6],
}
const SHORT: Record<string, string> = {
  north_western: 'North-West',
  north_east: 'North-East',
  south_central: 'South-Central',
  south_western: 'South-West',
}

export type CartogramMode = 'value' | 'overdue'

/**
 * AICTE regions as tiles. In value mode the tint shows value held; in overdue mode it shows the
 * share of held deposits matured without action. Every tile also states its figures in text.
 */
export function RegionCartogram({
  regions,
  mode = 'value',
  onSelect,
  overdueOverride,
}: {
  regions: Region[]
  mode?: CartogramMode
  onSelect?: (code: string) => void
  /** Overdue counts by region for a forecast date, replacing today's. */
  overdueOverride?: Record<string, number>
}) {
  const reduce = useReducedMotion()
  const maxHeld = Math.max(1, ...regions.map((r) => Number(r.held_paise)))
  return (
    <div>
      <div
        className="grid grid-cols-5 gap-1.5"
        style={{ gridTemplateRows: 'repeat(6, minmax(64px, auto))' }}
        role="list"
        aria-label="Regions"
      >
        {regions.map((r) => {
          const place = PLACE[r.code]
          if (!place) return null
          const held = Number(r.held_paise)
          const overdue = overdueOverride?.[r.code] ?? r.overdue
          const share = held ? Number(r.confirmed_paise) / held : 0
          const intensity =
            mode === 'value'
              ? 0.05 + 0.3 * Math.sqrt(held / maxHeld)
              : 0.05 + 0.4 * Math.min(1, r.held_count ? overdue / r.held_count / 0.25 : 0)
          const tint = mode === 'value' ? 'var(--brand)' : 'var(--overdue)'
          return (
            <Tip
              key={r.code}
              content={
                <span className="block text-left">
                  <span className="block font-medium">{r.name}</span>
                  <span className="block">
                    {formatINRCompact(held)} held in {formatCount(r.held_count)} deposits
                  </span>
                  <span className="block">{formatPercent(share)} bank-confirmed</span>
                  <span className="block">
                    {overdue} matured without action, {r.discrepancy} discrepancies
                  </span>
                </span>
              }
            >
              <motion.button
                type="button"
                role="listitem"
                onClick={() => onSelect?.(r.code)}
                aria-label={`${r.name}: ${formatINRCompact(held)} held, ${formatPercent(share)} bank-confirmed, ${overdue} matured without action`}
                style={{
                  gridColumn: place[0],
                  gridRow: place[1],
                }}
                animate={{
                  backgroundColor: `color-mix(in oklab, ${tint} ${Math.round(intensity * 100)}%, var(--surface))`,
                }}
                transition={{ duration: reduce ? 0 : 0.4 }}
                className={cn(
                  'relative flex flex-col justify-between rounded-[10px] border border-line p-2 text-left',
                  onSelect && 'hover:border-ink-3 focus-visible:border-accent',
                )}
              >
                <span className="truncate text-[0.6875rem] font-medium text-ink">
                  {SHORT[r.code] ?? r.name.replace(/ Region| \(camp office\)/, '')}
                </span>
                <span className="font-mono text-[0.75rem] whitespace-nowrap text-ink">
                  {formatINRCompact(held)}
                </span>
                {overdue ? (
                  <span className="absolute -top-2 -right-1.5 inline-flex items-center gap-0.5 rounded-full border border-overdue/50 bg-overdue-soft px-1.5 py-px text-[0.625rem] font-semibold text-overdue shadow-sm">
                    <AlertTriangle className="size-2.5" aria-hidden />
                    {overdue}
                  </span>
                ) : null}
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full bg-a2" style={{ width: `${share * 100}%` }} />
                </span>
              </motion.button>
            </Tip>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-ink-3">
        <span className="flex items-center gap-2">
          {mode === 'value' ? 'Less held' : 'Fewer overdue'}
          <span
            aria-hidden
            className="h-2 w-20 rounded-full"
            style={{
              background: `linear-gradient(to right, color-mix(in oklab, ${mode === 'value' ? 'var(--brand)' : 'var(--overdue)'} 5%, var(--surface)), color-mix(in oklab, ${mode === 'value' ? 'var(--brand)' : 'var(--overdue)'} 40%, var(--surface)))`,
            }}
          />
          {mode === 'value' ? 'More held' : 'More overdue'}
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="h-1 w-4 rounded-full bg-a2" aria-hidden /> bank-confirmed share
          </span>
        </span>
        <span>Tile cartogram of AICTE regions, not a map</span>
      </div>
    </div>
  )
}
