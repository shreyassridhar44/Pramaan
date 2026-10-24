import * as Popover from '@radix-ui/react-popover'
import { CalendarClock, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { addDays, daysBetween, useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

const RANGE_DAYS = 730

/**
 * The global "as of" control. Moving it forward re-computes every view for that date on the
 * server; nothing is saved while a forecast date is selected.
 */
export function AsOfControl() {
  const { asOf, isToday, today, setAsOf, offsetDays } = useAsOf()
  const months = useMemo(() => {
    const out: { iso: string; label: string; offset: number }[] = []
    const d = new Date(`${today}T00:00:00Z`)
    for (let i = 1; i <= 24; i++) {
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1))
      const iso = m.toISOString().slice(0, 10)
      out.push({
        iso,
        label: m.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
        offset: daysBetween(today, iso),
      })
    }
    return out
  }, [today])

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[0.8125rem] transition-colors',
            isToday
              ? 'border-line-strong bg-surface text-ink-2 hover:bg-sunken'
              : 'border-accent bg-accent-soft text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]',
          )}
          aria-label={`As of ${formatDate(asOf)}. Change the date`}
        >
          <CalendarClock className="size-4" aria-hidden />
          <span className="text-ink-3">As of</span>
          <span className="font-mono font-medium tabular-nums text-ink">{formatDate(asOf)}</span>
          {isToday ? (
            <span className="text-ink-3">Today</span>
          ) : (
            <span className="font-medium text-accent">+{offsetDays} days</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[560px] rounded-[var(--radius-panel)] border border-line bg-surface p-5 shadow-[var(--shadow-overlay)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">View the portfolio on another date</p>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Statuses, reminders and escalations are computed from current rules and data.
                Forecast views never save anything.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAsOf(null)} disabled={isToday}>
              <RotateCcw /> Today
            </Button>
          </div>
          <div className="mt-5">
            <input
              type="range"
              min={0}
              max={RANGE_DAYS}
              step={1}
              value={Math.max(0, Math.min(RANGE_DAYS, offsetDays))}
              onChange={(e) => setAsOf(addDays(today, Number(e.target.value)))}
              aria-label="Days from today"
              className="w-full accent-[var(--accent)]"
            />
            <div className="relative mt-2 h-4">
              {months
                .filter((_, i) => i % 3 === 2)
                .map((m) => (
                  <button
                    type="button"
                    key={m.iso}
                    onClick={() => setAsOf(m.iso)}
                    className="absolute -translate-x-1/2 text-[0.6875rem] text-ink-3 hover:text-ink"
                    style={{ left: `${(m.offset / RANGE_DAYS) * 100}%` }}
                  >
                    {m.label} {m.iso.slice(2, 4)}
                  </button>
                ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <label htmlFor="asof-date" className="text-[0.8125rem] text-ink-2">
              Exact date
            </label>
            <input
              id="asof-date"
              type="date"
              value={asOf}
              min={addDays(today, -3650)}
              max={addDays(today, RANGE_DAYS)}
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
              className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 font-mono text-[0.8125rem]"
            />
          </div>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
