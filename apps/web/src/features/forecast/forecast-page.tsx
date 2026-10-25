import { useQuery } from '@tanstack/react-query'
import { Expand, Pause, Play, RotateCcw, Shrink } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { MaturityRiver, RiverLegend } from '@/components/charts/maturity-river'
import { byMonth } from '@/components/charts/river-bands'
import { RegionCartogram } from '@/components/charts/region-cartogram'
import { Button } from '@/components/ui/button'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { useRegions, useRiver } from '@/features/command/queries'
import { RollingNumber } from '@/features/command/headline'
import { api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { todayIso } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINRCompact } from '@/lib/format'
import { setTheme, useTheme } from '@/lib/theme'

type Step = components['schemas']['TimelineStepOut']

const SPEEDS = [1, 2, 4] as const
const LEVEL = (s: string) => s.replaceAll('_', ' ')

/** One line per week for the event stream, in plain words. */
function describe(step: Step): string {
  const c = step.event_counts
  const parts: string[] = []
  if (c.reminder) parts.push(`${formatCount(c.reminder)} reminder${c.reminder > 1 ? 's' : ''}`)
  const escalated = step.events.filter((e) => e.kind === 'escalated')
  if (c.escalated) {
    const top = escalated.reduce<Record<string, number>>((acc, e) => {
      acc[e.detail] = (acc[e.detail] ?? 0) + 1
      return acc
    }, {})
    const detail = Object.entries(top)
      .map(([level, n]) => `${n} to ${LEVEL(level)}`)
      .join(', ')
    parts.push(`${formatCount(c.escalated)} escalation${c.escalated > 1 ? 's' : ''} (${detail})`)
  }
  if (c.matured)
    parts.push(
      c.matured > 1
        ? `${formatCount(c.matured)} deposits reach maturity`
        : '1 deposit reaches maturity',
    )
  return parts.length ? parts.join(', ') : 'No reminders, escalations or maturities'
}

/**
 * The next 12 months under current rules and data, week by week (PROTOTYPE.md 5.9). Read-only:
 * the same as-of engine as the rest of the product, nothing is saved.
 */
export function ForecastPage() {
  const reduce = useReducedMotion()
  const today = todayIso()
  const steps = useQuery({
    queryKey: ['portfolio', 'timeline', today],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/timeline', {
          params: { query: { start: today, weeks: 52, events_per_step: 200 } },
        }),
      ),
    staleTime: 5 * 60_000,
  })
  const regions = useRegions(today)
  const river = useRiver(today)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [full, setFull] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Command theme by default for the forecast, restored on leaving (not saved).
  const { theme } = useTheme()
  useEffect(() => {
    const before = theme
    setTheme('command', false)
    return () => setTheme(before, false)
    // Only on entering and leaving the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const data = steps.data ?? []
  const last = Math.max(0, data.length - 1)
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      const next = Math.min(last, index + 1)
      setIndex(next)
      if (next >= last) setPlaying(false)
    }, 1000 / speed)
    return () => clearTimeout(t)
  }, [playing, index, last, speed])

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const step = data[index]
  const months = useMemo(() => byMonth(river.data ?? []), [river.data])
  const regionRows = useMemo(() => {
    if (!regions.data || !step) return regions.data ?? []
    return regions.data.map((r) => {
      const at = step.by_region[r.code]
      return at
        ? {
            ...r,
            held_paise: String(at.held_paise ?? 0),
            held_count: at.held_count ?? 0,
            confirmed_paise: String(at.confirmed_paise ?? 0),
            overdue: at.overdue ?? 0,
            discrepancy: at.discrepancy ?? 0,
          }
        : r
    })
  }, [regions.data, step])
  const stream = data.slice(Math.max(0, index - 5), index + 1).reverse()
  // Every matured deposit starts with the dealing officer; count only what has gone higher.
  const escalations = step
    ? Object.entries(step.escalations)
        .filter(([level]) => level !== 'dealing_officer')
        .reduce((a, [, n]) => a + n, 0)
    : 0
  const held = step ? Number(step.held_paise) : 0
  const confirmedShare = step && held ? Number(step.confirmed_paise) / held : 0

  return (
    <div ref={root} className={cn('grid gap-5', full && 'overflow-y-auto bg-canvas p-6')}>
      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="icon"
              onClick={() => {
                if (index >= last) setIndex(0)
                setPlaying((p) => !p)
              }}
              disabled={!data.length}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setPlaying(false)
                setIndex(0)
              }}
              aria-label="Back to today"
            >
              <RotateCcw />
            </Button>
          </div>
          <div className="min-w-[200px]">
            <p className="text-[0.6875rem] font-medium tracking-[0.06em] text-ink-3 uppercase">
              Week of
            </p>
            <p className="font-mono text-[1.25rem] text-ink">
              {step ? formatDate(step.start) : 'Loading'}
            </p>
          </div>
          <label className="flex min-w-[240px] flex-1 items-center gap-3">
            <span className="sr-only">Week</span>
            <input
              type="range"
              min={0}
              max={last}
              value={index}
              onChange={(e) => {
                setPlaying(false)
                setIndex(Number(e.target.value))
              }}
              className="w-full accent-[var(--accent)]"
              aria-valuetext={step ? `Week of ${formatDate(step.start)}` : undefined}
            />
          </label>
          <div
            className="flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1"
            role="group"
            aria-label="Speed"
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  'rounded-md px-2.5 py-1 font-mono text-[0.75rem]',
                  speed === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
                )}
              >
                {s}x
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              document.fullscreenElement
                ? void document.exitFullscreen()
                : void root.current?.requestFullscreen()
            }
          >
            {full ? <Shrink /> : <Expand />} {full ? 'Exit full screen' : 'Full screen'}
          </Button>
        </div>
        <p className="mt-3 text-[0.75rem] text-ink-3">
          Forecast from current rules and data, one week per second at 1x. Nothing is saved.
        </p>
      </Panel>

      {steps.isError ? (
        <Panel>
          <ErrorState error={steps.error} onRetry={() => void steps.refetch()} />
        </Panel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid content-start gap-5 xl:col-span-7">
          <Panel>
            <PanelHeader
              title="Overdue by region"
              caption="Share of held deposits matured without a renewal or release application"
            />
            <div className="px-5 pb-5">
              {regionRows.length && step ? (
                <RegionCartogram regions={regionRows} mode="overdue" />
              ) : (
                <Skeleton className="h-[420px]" />
              )}
            </div>
          </Panel>
          <Panel>
            <PanelHeader
              title="What matures when"
              caption="The playhead follows the forecast week"
              actions={<RiverLegend />}
            />
            <div className="px-3 pb-3">
              {river.data && step ? (
                <MaturityRiver
                  weeks={months}
                  asOf={today}
                  playhead={step.start}
                  period="month"
                  height={260}
                  label="Value maturing each month by proof level, with the forecast week marked"
                />
              ) : (
                <Skeleton className="h-[260px]" />
              )}
            </div>
          </Panel>
        </div>
        <div className="grid content-start gap-5 xl:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            <Figure
              label="Value held"
              value={held}
              format={(n) => formatINRCompact(Math.round(n))}
            />
            <Figure
              label="Bank-confirmed"
              value={confirmedShare * 100}
              format={(n) => `${n.toFixed(0)}%`}
            />
            <Figure
              label="Matured without action"
              value={step?.overdue_count ?? 0}
              format={(n) => formatCount(Math.round(n))}
              tone="overdue"
            />
            <Figure
              label="Escalated above the dealing officer"
              value={escalations}
              format={(n) => formatCount(Math.round(n))}
              tone="due"
            />
          </div>
          <Panel>
            <PanelHeader title="Event stream" caption="What the rules would do, week by week" />
            <ol className="px-5 pb-4" aria-live="polite">
              <AnimatePresence initial={false} mode="popLayout">
                {stream.map((s) => (
                  <motion.li
                    key={s.start}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="border-t border-line py-2.5 first:border-0"
                  >
                    <p className="font-mono text-[0.6875rem] text-ink-3">
                      Week of {formatDate(s.start)}
                    </p>
                    <p className="text-[0.8125rem] text-ink">{describe(s)}</p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  format,
  tone,
}: {
  label: string
  value: number
  format: (n: number) => string
  tone?: 'overdue' | 'due'
}) {
  return (
    <Panel className="p-4">
      <p className="text-[0.75rem] text-ink-3">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-[2.25rem] leading-none',
          tone === 'overdue' ? 'text-overdue' : tone === 'due' ? 'text-due' : 'text-ink',
        )}
      >
        <RollingNumber value={value} format={format} />
      </p>
    </Panel>
  )
}
