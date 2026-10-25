import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { BellRing, ShieldQuestion } from 'lucide-react'

import { RegionCartogram } from '@/components/charts/region-cartogram'
import { Sparkline } from '@/components/charts/sparkline'
import { AssuranceRing } from '@/components/signature/assurance'
import type { AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount, SeverityChip } from '@/components/signature/chips'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'
import { formatDate, formatPercent } from '@/lib/format'

import { useRegions } from './queries'

export function RegionPanel() {
  const { asOf, isToday } = useAsOf()
  const navigate = useNavigate()
  const q = useRegions(asOf)
  return (
    <Panel className="h-full">
      <PanelHeader title="Where the money is" caption="AICTE regions by value held" />
      <div className="px-5 pb-5">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
        ) : q.isPending ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <RegionCartogram
            regions={q.data}
            onSelect={(code) =>
              void navigate({
                to: '/instruments',
                search: { region: [code], ...(isToday ? {} : { asOf }) },
              })
            }
          />
        )}
      </div>
    </Panel>
  )
}

export function ExposuresList() {
  const { asOf, isToday } = useAsOf()
  const q = useQuery({
    queryKey: ['portfolio', 'exposures', asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/exposures', {
          params: { query: { as_of: asOf, limit: 5 } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  return (
    <div className="border-t border-line px-5 pt-4 pb-5">
      <p className="text-[0.75rem] font-medium text-ink-2">Largest unproven exposures</p>
      {q.isError ? (
        <ErrorState error={q.error} compact />
      ) : q.isPending ? (
        <Skeleton className="mt-2 h-28" />
      ) : q.data.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] text-ink-3">Every held deposit is bank-confirmed.</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {q.data.map((e) => (
            <li key={e.instrument_id}>
              <Link
                to="/instruments/$instrumentId"
                params={{ instrumentId: String(e.instrument_id) }}
                search={isToday ? {} : { asOf }}
                className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-sunken/60"
              >
                <AssuranceRing level={e.assurance as AssuranceLevel} size={16} showTip={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-ink">{e.institution}</span>
                  <span className="block truncate text-[0.6875rem] text-ink-3">{e.bank}</span>
                </span>
                <Amount paise={e.amount_paise} compact className="text-[0.8125rem]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RecentSignals() {
  const { asOf, isToday } = useAsOf()
  const q = useQuery({
    queryKey: ['portfolio', 'signals'],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/signals', { params: { query: { limit: 6 } } })),
  })
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Recent signals"
        caption="Possible issues found by document checks and bank responses, for review"
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : q.isPending ? (
        <div className="grid gap-2 px-5 pb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState icon={<ShieldQuestion />} title="No open signals" />
      ) : (
        <ul className="px-5 pb-4">
          {q.data.map((s) => (
            <li key={s.id} className="border-t border-line first:border-0">
              <Link
                to="/instruments/$instrumentId"
                params={{ instrumentId: String(s.instrument_id) }}
                search={isToday ? {} : { asOf }}
                className="flex items-start gap-3 py-3 hover:text-brand"
              >
                <SeverityChip severity={s.severity} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-medium text-ink">{s.title}</span>
                  <span className="block truncate text-[0.75rem] text-ink-3">
                    {s.institution} · <span className="font-mono">{s.number}</span>
                  </span>
                </span>
                <span className="shrink-0 text-[0.6875rem] text-ink-3">
                  {formatDate(s.raised_on)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Measure({
  label,
  value,
  sub,
  children,
}: {
  label: string
  value: string
  sub: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line p-4">
      <p className="text-[0.75rem] text-ink-3">{label}</p>
      <p className="mt-1 font-display text-[2rem] leading-none text-ink">{value}</p>
      <p className="mt-1 text-[0.75rem] text-ink-3">{sub}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

/** Product measures for R15, each computed from the data and labelled as synthetic. */
export function ImpactPanel() {
  const { asOf } = useAsOf()
  const q = useQuery({
    queryKey: ['portfolio', 'impact', asOf],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/impact', { params: { query: { as_of: asOf } } })),
    placeholderData: (prev) => prev,
  })
  const d = q.data
  const pct = (v: number | null | undefined) => (v == null ? 'No data' : formatPercent(v))
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Is it working?"
        caption="Measured from the records over the last 12 months. Computed from synthetic data."
        actions={<BellRing className="size-4 text-ink-3" aria-hidden />}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : !d ? (
        <Skeleton className="mx-5 mb-5 h-56" />
      ) : (
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          <Measure
            label="Verification turnaround"
            value={
              d.verification_turnaround_days.median == null
                ? 'No data'
                : `${d.verification_turnaround_days.median} d`
            }
            sub={`Median; 90th percentile ${d.verification_turnaround_days.p90 ?? 'n/a'} days, ${d.verification_turnaround_days.sample} verified`}
          >
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
          </Measure>
          <Measure
            label="Field agreement with the bank"
            value={pct(d.field_agreement_rate)}
            sub="Bank-confirmed deposits with no conflicting field"
          />
          <Measure
            label="Reminders sent on time"
            value={pct(d.reminders_on_time_rate)}
            sub={`${d.reminders_sample.toLocaleString('en-IN')} reminders due so far`}
          />
          <Measure
            label="Held without an owner"
            value={d.held_without_owner.toLocaleString('en-IN')}
            sub={`of ${d.held_count.toLocaleString('en-IN')} held deposits`}
          />
        </div>
      )}
    </Panel>
  )
}
