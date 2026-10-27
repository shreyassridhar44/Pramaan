import { useQuery } from '@tanstack/react-query'
import { Expand, Pause, Play, RotateCcw, Shrink } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { MaturityRiver } from '@/components/charts/maturity-river'
import { RiverLegend } from '@/components/charts/river-legend'
import { byMonth } from '@/components/charts/river-bands'
import { IsoIndia } from '@/components/charts/iso-india'
import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { SplitFlap } from '@/components/security/split-flap'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { useRegions, useRiver } from '@/features/command/queries'
import { api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { todayIso } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINRCompact } from '@/lib/format'

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
    <div
      ref={root}
      data-tour="forecast"
      className={cn('grid gap-5', full && 'overflow-y-auto bg-canvas p-6')}
    >
      <section className="relative overflow-hidden rounded-[18px] bg-board text-board-ink shadow-[0_30px_70px_-40px_rgb(0_0_0/0.8)]">
        <RosetteMark
          seed="time-machine"
          className="spin-slow pointer-events-none absolute -top-56 -right-40 size-[620px]"
          color="rgb(var(--board-ink-rgb) / 0.05)"
        />
        <GuillocheBand height={12} color="rgb(255 153 51 / 0.4)" />
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5 px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (index >= last) setIndex(0)
                setPlaying((p) => !p)
              }}
              disabled={!data.length}
              aria-label={playing ? 'Pause' : 'Play'}
              className="relative grid size-16 place-items-center rounded-full bg-saffron text-board shadow-[0_0_0_6px_rgb(255_153_51/0.18),0_0_40px_rgb(255_153_51/0.45)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {playing ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-saffron/30 motion-reduce:animate-none" />
              ) : null}
              {playing ? (
                <Pause className="relative size-6" />
              ) : (
                <Play className="relative ml-1 size-6" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                setIndex(0)
              }}
              aria-label="Back to today"
              className="grid size-10 place-items-center rounded-full bg-board-ink/10 hover:bg-board-ink/20"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
          <div>
            <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-board-ink/70 uppercase">
              Forecast week of
            </p>
            <p className="mt-1 text-[1.75rem] text-board-accent">
              <SplitFlap value={step ? boardDate(step.start) : '-- --- ----'} stagger={20} />
            </p>
          </div>
          <div>
            <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-board-ink/70 uppercase">
              Ahead of today
            </p>
            <p className="mt-1 text-[1.75rem]">
              <SplitFlap value={`+${String(index * 7).padStart(3, '0')} D`} stagger={20} />
            </p>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="block">
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
                className="time-scrubber w-full"
                style={{ ['--pct' as string]: `${last ? (index / last) * 100 : 0}%` }}
                aria-valuetext={step ? `Week of ${formatDate(step.start)}` : undefined}
              />
            </label>
            <div
              className="mt-1 flex justify-between font-mono text-[0.625rem] text-board-ink/70"
              aria-hidden
            >
              {data
                .filter((_, i) => i % 9 === 0)
                .map((d) => (
                  <span key={d.start}>
                    {new Date(d.start).toLocaleDateString('en-IN', {
                      month: 'short',
                      year: '2-digit',
                    })}
                  </span>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex gap-1 rounded-full bg-board-ink/10 p-1"
              role="group"
              aria-label="Speed"
            >
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpeed(sp)}
                  aria-pressed={speed === sp}
                  className={cn(
                    'rounded-full px-3 py-1 font-mono text-[0.75rem]',
                    speed === sp
                      ? 'bg-board-ink text-board'
                      : 'text-board-ink/70 hover:text-board-ink',
                  )}
                >
                  {sp}x
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                document.fullscreenElement
                  ? void document.exitFullscreen()
                  : void root.current?.requestFullscreen()
              }
              className="flex items-center gap-1.5 rounded-full bg-board-ink/10 px-3 py-1.5 text-[0.75rem] hover:bg-board-ink/20"
            >
              {full ? <Shrink className="size-3.5" /> : <Expand className="size-3.5" />}
              {full ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        </div>
        <div className="relative grid grid-cols-2 border-t border-board-ink/10 lg:grid-cols-4 lg:divide-x lg:divide-board-ink/10">
          <BoardFigure label="Value held" value={formatINRCompact(Math.round(held))} />
          <BoardFigure
            label="Bank-confirmed"
            value={`${(confirmedShare * 100).toFixed(0)}%`}
            tone="text-board-a2"
          />
          <BoardFigure
            label="Matured without action"
            value={formatCount(step?.overdue_count ?? 0)}
            tone="text-board-overdue"
          />
          <BoardFigure
            label="Escalated above dealing officer"
            value={formatCount(escalations)}
            tone="text-board-due"
          />
        </div>
        <p className="relative border-t border-board-ink/10 px-6 py-2 text-[0.6875rem] text-board-ink/65">
          Forecast from current rules and data, one week per second at 1x. Nothing is saved.
        </p>
      </section>

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
              caption="Towers grow and shrink with value held; beacons light up where deposits mature without action"
            />
            <div className="px-5 pb-5">
              {regionRows.length && step ? (
                <IsoIndia regions={regionRows} />
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

function boardDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

function BoardFigure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-6 py-4">
      <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-board-ink/65 uppercase">
        {label}
      </p>
      <p className={cn('mt-2 font-display text-[2.5rem] leading-none', tone ?? 'text-board-ink')}>
        <SplitFlap value={value} variant="inline" stagger={25} />
      </p>
    </div>
  )
}
