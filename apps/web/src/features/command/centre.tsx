import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Cpu, FileWarning, Inbox, Landmark, ShieldQuestion } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { Dial } from '@/components/charts/dial'
import { PULSE_SERIES, PulseTrace } from '@/components/charts/pulse-trace'
import { Sparkline } from '@/components/charts/sparkline'
import { RubberStamp, type StampInk } from '@/components/security/stamp'
import { Amount } from '@/components/signature/chips'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatPercent } from '@/lib/format'
import { useMe } from '@/lib/session'

import { useSummary } from './queries'

function usePulse(asOf: string) {
  return useQuery({
    queryKey: ['portfolio', 'pulse', asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/pulse', { params: { query: { as_of: asOf, days: 90 } } }),
      ),
    placeholderData: (prev) => prev,
  })
}

function greeting() {
  const h = Number(
    new Date().toLocaleString('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }),
  )
  if (h < 12) return { en: 'Good morning', hi: 'सुप्रभात' }
  if (h < 17) return { en: 'Good afternoon', hi: 'नमस्कार' }
  return { en: 'Good evening', hi: 'शुभ संध्या' }
}

/** The officer's brief: a greeting and today's situation in one sentence, computed from data. */
export function Brief() {
  const me = useMe().data
  const { asOf, isToday } = useAsOf()
  const s = useSummary().data
  const pulse = usePulse(asOf).data
  const month = (pulse ?? []).slice(-30)
  const sum = (k: (typeof PULSE_SERIES)[number]['key']) => month.reduce((a, d) => a + d[k], 0)
  const g = greeting()
  const date = new Date(`${asOf}T00:00:00`)
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
      <div>
        <p className="flex items-baseline gap-3">
          <span lang="hi" className="font-deva text-[1rem] text-accent">
            {g.hi}
          </span>
          <span className="text-[0.75rem] text-ink-3">
            {date.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            <span lang="hi" className="ml-2 font-deva">
              {date.toLocaleDateString('hi-IN', { day: 'numeric', month: 'long' })}
            </span>
          </span>
        </p>
        <h2 className="mt-1 font-display text-[2.5rem] leading-none text-ink">
          {g.en}, {me?.name.split(' ')[0] ?? 'officer'}.
        </h2>
      </div>
      {s ? (
        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">
          {isToday ? 'Today' : `On ${formatDate(asOf)}`},{' '}
          <strong className="font-semibold text-overdue">
            {formatCount(s.overdue_count)} matured deposits
          </strong>{' '}
          wait for a renewal or release decision,{' '}
          <strong className="font-semibold text-ink">
            {formatCount(s.pending_verification_count)} submissions
          </strong>{' '}
          await scrutiny and{' '}
          <strong className="font-semibold text-due">
            {formatCount(s.discrepancy_count)} discrepancies
          </strong>{' '}
          need a look.
          {sum('bank') + sum('reminders') > 0 ? (
            <>
              {' '}
              In the last 30 days
              {sum('bank') > 0 ? (
                <>
                  {' '}
                  banks confirmed{' '}
                  <strong className="font-semibold text-a2">{formatCount(sum('bank'))}</strong>{' '}
                  deposits
                </>
              ) : null}
              {sum('bank') > 0 && sum('reminders') > 0 ? ' and' : null}
              {sum('reminders') > 0 ? (
                <>
                  {' '}
                  Pramaan sent{' '}
                  <strong className="font-semibold text-ink">
                    {formatCount(sum('reminders'))}
                  </strong>{' '}
                  reminders
                </>
              ) : null}
              .
            </>
          ) : null}
        </p>
      ) : (
        <Skeleton className="h-12 w-[520px]" />
      )}
    </div>
  )
}

/** The activity monitor under the headline board. */
export function PulseMonitor() {
  const { asOf } = useAsOf()
  const q = usePulse(asOf)
  const days = q.data ?? []
  return (
    <div className="relative border-t border-white/10 px-6 pt-4 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-board-ink/70 uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-board-a2/70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-board-a2" />
          </span>
          Portfolio pulse, last 90 days
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {PULSE_SERIES.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-1.5 text-[0.6875rem] text-board-ink/70"
            >
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              {s.label}
              <span className="font-mono text-board-ink">
                {formatCount(days.reduce((a, d) => a + d[s.key], 0))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-2">
        {q.isError ? (
          <p className="py-10 text-center text-[0.8125rem] text-board-ink/60">
            The activity trace could not be loaded.
          </p>
        ) : days.length ? (
          <PulseTrace days={days} />
        ) : (
          <div className="h-[150px] animate-pulse rounded bg-white/[0.03]" />
        )}
      </div>
    </div>
  )
}

const KIND: Record<string, { stamp: string; ink: StampInk; tab: string }> = {
  overdue: { stamp: 'Overdue', ink: 'red', tab: 'bg-[var(--band-red)]' },
  discrepancy: { stamp: 'Mismatch', ink: 'copper', tab: 'bg-[var(--band-copper)]' },
  scrutiny: { stamp: 'Scrutiny', ink: 'navy', tab: 'bg-[var(--band-navy)]' },
  maturing: { stamp: 'Maturing', ink: 'green', tab: 'bg-[var(--band-green)]' },
}

function kindOf(item: { kind: string; severity: string }) {
  const k = item.kind.toLowerCase()
  if (k.includes('overdue') || k.includes('matured')) return KIND.overdue!
  if (k.includes('discrep') || k.includes('conflict') || k.includes('signal'))
    return KIND.discrepancy!
  if (k.includes('matur') || k.includes('renew')) return KIND.maturing!
  return KIND.scrutiny!
}

function daysBetween(due: string, asOf: string) {
  return Math.round((new Date(due).getTime() - new Date(asOf).getTime()) / 86_400_000)
}

/** The action queue as a docket of case files, each with its stamp and a countdown. */
export function ActionDocket({ onOpen }: { onOpen: (id: number) => void }) {
  const { asOf, isToday } = useAsOf()
  const reduce = useReducedMotion()
  const q = useQuery({
    queryKey: ['portfolio', 'action-queue', asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/action-queue', {
          params: { query: { as_of: asOf, limit: 8 } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Today's docket"
        caption="The next things to do, by severity and due date. Open a file beside this view."
        actions={
          <Link
            to="/instruments"
            search={isToday ? {} : { asOf }}
            className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand hover:underline"
          >
            Open registry <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : q.isPending ? (
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Nothing needs action on this date"
          body="Reminders run every morning at 06:00."
        />
      ) : (
        <ul className="grid gap-3 px-5 pt-1 pb-5 sm:grid-cols-2">
          {q.data.map((item, i) => {
            const k = kindOf(item)
            const d = daysBetween(item.due, asOf)
            return (
              <motion.li
                key={`${item.kind}-${item.instrument_id}`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.05 }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(item.instrument_id)}
                  className="group relative block w-full pt-3 text-left"
                  aria-label={`${item.title}, ${item.institution}`}
                >
                  <span
                    className={cn('absolute top-0 left-4 h-4 w-20 rounded-t-md', k.tab)}
                    aria-hidden
                  />
                  <span className="relative block overflow-hidden rounded-[12px] rounded-tl-none border border-line bg-paper p-4 shadow-[0_1px_0_rgb(18_23_38/0.04)] transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-ink-3 group-hover:shadow-[var(--shadow-lift)]">
                    <span className="paper-grain absolute inset-0" aria-hidden />
                    <span className="absolute -top-1 right-1 w-[110px] opacity-90" aria-hidden>
                      <RubberStamp
                        title={k.stamp}
                        ink={k.ink}
                        rotate={-10 + (i % 3) * 6}
                        className="h-[50px]"
                      />
                    </span>
                    <span className="relative block pr-24">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.75rem] text-ink-3">
                        {item.institution}
                      </span>
                    </span>
                    <span className="relative mt-3 flex items-end justify-between gap-3">
                      <span>
                        <span className="block font-mono text-[0.6875rem] text-ink-3">
                          {item.number}
                        </span>
                        <Amount
                          paise={item.amount_paise}
                          compact
                          className="font-display text-[1.375rem] leading-none"
                        />
                      </span>
                      <span
                        className={cn(
                          'rounded-md px-2 py-1 text-right font-mono text-[0.75rem] leading-tight',
                          d < 0
                            ? 'bg-overdue-soft text-overdue'
                            : d <= 7
                              ? 'bg-due-soft text-due'
                              : 'bg-sunken text-ink-2',
                        )}
                      >
                        {d < 0 ? `${-d} d late` : d === 0 ? 'due today' : `in ${d} d`}
                        <span className="block text-[0.625rem] opacity-80">
                          {item.owner ?? 'Unassigned'}
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** Signals as case cards: what was found, by which check, and when. */
export function SignalCards() {
  const { asOf, isToday } = useAsOf()
  const reduce = useReducedMotion()
  const q = useQuery({
    queryKey: ['portfolio', 'signals'],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/signals', { params: { query: { limit: 6 } } })),
  })
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Signals for review"
        caption="Possible issues found by document checks, models and bank responses. Prompts, not findings."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : q.isPending ? (
        <div className="grid gap-2 px-5 pb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState icon={<ShieldQuestion />} title="No open signals" />
      ) : (
        <ul className="grid gap-2.5 px-5 pb-5">
          {q.data.map((s, i) => {
            const high = s.severity === 'high'
            const Icon = /bank|provenance/i.test(s.title)
              ? Landmark
              : /alter|edit|forens/i.test(s.title)
                ? Cpu
                : FileWarning
            return (
              <motion.li
                key={s.id}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.05 }}
              >
                <Link
                  to="/instruments/$instrumentId"
                  params={{ instrumentId: String(s.instrument_id) }}
                  search={isToday ? {} : { asOf }}
                  className="group relative flex items-start gap-3 overflow-hidden rounded-[12px] border border-line bg-surface p-3 pl-4 transition-[border-color,box-shadow] hover:border-ink-3 hover:shadow-[var(--shadow-lift)]"
                >
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 w-1',
                      high ? 'bg-overdue' : s.severity === 'medium' ? 'bg-due' : 'bg-ink-3',
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg',
                      high ? 'bg-overdue-soft text-overdue' : 'bg-sunken text-ink-2',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.8125rem] font-semibold text-ink group-hover:text-brand">
                        {s.title}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-px text-[0.625rem] font-semibold tracking-[0.06em] uppercase',
                          high ? 'bg-overdue-soft text-overdue' : 'bg-sunken text-ink-2',
                        )}
                      >
                        {s.severity}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.75rem] text-ink-3">
                      {s.institution} · <span className="font-mono">{s.number}</span> ·{' '}
                      {formatDate(s.raised_on)}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** R15 measures as instruments on a panel, each computed from the records. */
export function ImpactDials() {
  const { asOf } = useAsOf()
  const q = useQuery({
    queryKey: ['portfolio', 'impact', asOf],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/impact', { params: { query: { as_of: asOf } } })),
    placeholderData: (prev) => prev,
  })
  const d = q.data
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Is it working?"
        caption="Measured from the records over the last 12 months. Computed from synthetic data."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : !d ? (
        <Skeleton className="mx-5 mb-5 h-56" />
      ) : (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Gauge
              label="Verification turnaround"
              sub={`median, ${d.verification_turnaround_days.sample} verified`}
            >
              <Dial
                label="Median verification turnaround"
                value={
                  d.verification_turnaround_days.median == null
                    ? null
                    : Math.min(1, d.verification_turnaround_days.median / 30)
                }
                reading={
                  d.verification_turnaround_days.median == null
                    ? 'n/a'
                    : String(d.verification_turnaround_days.median)
                }
                unit="days"
                good="low"
              />
            </Gauge>
            <Gauge label="Agreement with the bank" sub="confirmed with no conflicting field">
              <Dial
                label="Field agreement with the bank"
                value={d.field_agreement_rate}
                reading={
                  d.field_agreement_rate == null ? 'n/a' : formatPercent(d.field_agreement_rate)
                }
                unit="of fields"
              />
            </Gauge>
            <Gauge label="Reminders on time" sub={`${formatCount(d.reminders_sample)} due so far`}>
              <Dial
                label="Reminders sent on time"
                value={d.reminders_on_time_rate}
                reading={
                  d.reminders_on_time_rate == null ? 'n/a' : formatPercent(d.reminders_on_time_rate)
                }
                unit="on time"
              />
            </Gauge>
            <Gauge
              label="Held with an owner"
              sub={`${formatCount(d.held_without_owner)} of ${formatCount(d.held_count)} unowned`}
            >
              <Dial
                label="Held deposits with an owner"
                value={d.held_count ? 1 - d.held_without_owner / d.held_count : null}
                reading={
                  d.held_count ? formatPercent(1 - d.held_without_owner / d.held_count) : 'n/a'
                }
                unit="owned"
              />
            </Gauge>
          </div>
          {d.turnaround_trend.length ? (
            <div className="mt-4 rounded-[12px] border border-line p-3">
              <p className="text-[0.6875rem] font-medium tracking-[0.06em] text-ink-3 uppercase">
                Turnaround by month
              </p>
              <Sparkline
                points={d.turnaround_trend.map((t) => ({
                  label: new Date(`${t.month}-01`).toLocaleDateString('en-IN', {
                    month: 'short',
                    year: 'numeric',
                  }),
                  value: t.median_days,
                }))}
                format={(v) => `${v} days`}
                label="Median verification turnaround by month"
              />
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  )
}

function Gauge({
  label,
  sub,
  children,
}: {
  label: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[12px] border border-line bg-paper/60 px-2 pt-2 pb-3 text-center">
      {children}
      <p className="-mt-2 text-[0.75rem] font-semibold text-ink">{label}</p>
      <p className="text-[0.6875rem] text-ink-3">{sub}</p>
    </div>
  )
}
