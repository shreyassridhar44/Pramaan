import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Inbox } from 'lucide-react'
import { useState } from 'react'

import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { Seal } from '@/components/security/seal'
import { Amount, SeverityChip, StatusChip } from '@/components/signature/chips'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { addDays, useAsOf } from '@/lib/asof'
import {
  formatCount,
  formatDate,
  formatINRCompact,
  formatPercent,
  formatRelativeDays,
} from '@/lib/format'

import { HeadlineFigure, RollingNumber } from './headline'
import { InstrumentSheet } from './instrument-sheet'
import { ExposuresList, ImpactPanel, RecentSignals, RegionPanel } from './overview-panels'
import { useSummary } from './queries'
import { RiverPanel } from './river-panel'

export function CommandView() {
  const summary = useSummary()
  const [sheet, setSheet] = useState<number | null>(null)
  return (
    <div className="grid gap-5">
      <HeadlineBand />
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <RiverPanel />
        </div>
        <div className="xl:col-span-4">
          <AssuranceComposition data={summary.data} loading={summary.isPending} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <RegionPanel />
        </div>
        <div className="xl:col-span-7">
          <ActionQueue onOpen={setSheet} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <RecentSignals />
        </div>
        <div className="xl:col-span-6">
          <ImpactPanel />
        </div>
      </div>
      <InstrumentSheet id={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function delta(now: number, before: number | undefined, format: (n: number) => string) {
  if (before === undefined) return null
  const d = now - before
  if (Math.abs(d) < 1e-9) return 'no change in 30 days'
  return `${d > 0 ? '+' : '-'}${format(Math.abs(d))} in 30 days`
}

function HeadlineBand() {
  const { data, isPending, isError, error, refetch } = useSummary()
  const { asOf } = useAsOf()
  const before = useSummary(addDays(asOf, -30)).data
  if (isError)
    return (
      <Panel>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Panel>
    )
  if (isPending || !data)
    return (
      <div className="grid grid-cols-1 overflow-hidden rounded-[14px] bg-board md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-6 py-5 opacity-30">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-12 w-40" />
            <Skeleton className="mt-3 h-3 w-48" />
          </div>
        ))}
      </div>
    )
  const held = Number(data.held_paise)
  const confirmed = Number(data.by_assurance_paise.a2) + Number(data.by_assurance_paise.a3)
  const share = held ? confirmed / held : 0
  const bHeld = before ? Number(before.held_paise) : undefined
  const bShare =
    before && Number(before.held_paise)
      ? (Number(before.by_assurance_paise.a2) + Number(before.by_assurance_paise.a3)) /
        Number(before.held_paise)
      : undefined
  const money = (n: number) => formatINRCompact(Math.round(n))
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-board text-board-ink shadow-[0_30px_60px_-40px_rgb(18_23_38/0.8)]">
      <RosetteMark
        seed="command-board"
        className="spin-slower pointer-events-none absolute -top-48 right-[18%] size-[520px]"
        color="rgb(255 255 255 / 0.05)"
      />
      <GuillocheBand height={14} color="rgb(255 153 51 / 0.35)" />
      <div className="relative grid grid-cols-1 divide-white/10 md:grid-cols-2 xl:grid-cols-4 xl:divide-x">
        <HeadlineFigure
          label="Value held in trust"
          figure={<RollingNumber value={held} format={(n) => formatINRCompact(Math.round(n))} />}
          caption={`${formatCount(data.held_count)} instruments across ${Object.keys(data.by_bank_paise).length} banks`}
          delta={delta(held, bHeld, money)}
        />
        <HeadlineFigure
          label="Bank-confirmed"
          tone="a2"
          figure={<RollingNumber value={share * 100} format={(n) => `${n.toFixed(0)}%`} />}
          caption={`${formatINRCompact(confirmed)} proven by the issuing bank`}
          delta={delta(
            share * 100,
            bShare === undefined ? undefined : bShare * 100,
            (n) => `${n.toFixed(1)} points`,
          )}
          aside={
            <Seal
              size={78}
              tone="board"
              seed="bank-confirmed"
              legend="Bank-confirmed  •  Signed  •  "
              label={`Assurance ${share >= 0.5 ? 'A2' : 'A1'} across the portfolio`}
            />
          }
        />
        <HeadlineFigure
          label="Needs action"
          tone={data.needs_action_count ? 'overdue' : 'default'}
          figure={<RollingNumber value={data.needs_action_count} format={(n) => formatCount(n)} />}
          caption={`${data.overdue_count} matured without action, ${data.discrepancy_count} discrepancies, ${data.pending_verification_count} awaiting scrutiny`}
          delta={delta(data.needs_action_count, before?.needs_action_count, (n) => formatCount(n))}
        />
        <HeadlineFigure
          label="Maturing in 90 days"
          tone="due"
          figure={
            <RollingNumber
              value={Number(data.maturing_90_paise)}
              format={(n) => formatINRCompact(Math.round(n))}
            />
          }
          caption={`${data.maturing_90_count} instruments need a renewal or release plan`}
          delta={delta(
            Number(data.maturing_90_paise),
            before ? Number(before.maturing_90_paise) : undefined,
            money,
          )}
        />
      </div>
    </div>
  )
}

function AssuranceComposition({
  data,
  loading,
}: {
  data: ReturnType<typeof useSummary>['data']
  loading: boolean
}) {
  const levels: AssuranceLevel[] = [3, 2, 1, 0]
  const total = data ? Number(data.held_paise) : 0
  return (
    <Panel className="h-full">
      <PanelHeader
        title="How well the money is proven"
        caption="Share of value held, by assurance level"
      />
      <div className="px-5 pb-5">
        {loading || !data ? (
          <Skeleton className="h-4 w-full" />
        ) : (
          <>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-sunken"
              role="img"
              aria-label="Assurance composition"
            >
              {levels.map((l) => {
                const v = Number(data.by_assurance_paise[`a${l}` as 'a0'])
                return (
                  <div
                    key={l}
                    style={{
                      width: `${total ? (v / total) * 100 : 0}%`,
                      background: ASSURANCE[l].color,
                    }}
                    className="h-full transition-[width] duration-500"
                  />
                )
              })}
            </div>
            <ul className="mt-4 grid gap-2.5">
              {levels.map((l) => {
                const v = Number(data.by_assurance_paise[`a${l}` as 'a0'])
                return (
                  <li key={l} className="flex items-center gap-3 text-[0.8125rem]">
                    <AssuranceRing level={l} size={18} />
                    <span className="flex-1 text-ink-2">{ASSURANCE[l].name}</span>
                    <span className="font-mono tabular-nums text-ink">{formatINRCompact(v)}</span>
                    <span className="w-12 text-right font-mono tabular-nums text-ink-3">
                      {formatPercent(total ? v / total : 0)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
      <ExposuresList />
    </Panel>
  )
}

function ActionQueue({ onOpen }: { onOpen: (id: number) => void }) {
  const { asOf, isToday } = useAsOf()
  const q = useQuery({
    queryKey: ['portfolio', 'action-queue', asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/action-queue', {
          params: { query: { as_of: asOf, limit: 10 } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  return (
    <Panel>
      <PanelHeader
        title="Action queue"
        caption="The next things to do, by severity and due date"
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
        <div className="grid gap-2 px-5 pb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Nothing needs action on this date"
          body="Reminders run every morning at 06:00."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-y border-line bg-sunken/60 text-left text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
                <th className="px-5 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">What</th>
                <th className="px-3 py-2 font-medium">Institution</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="hidden px-5 py-2 font-medium 2xl:table-cell">Owner</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((item) => (
                <tr
                  key={`${item.kind}-${item.instrument_id}`}
                  onClick={() => onOpen(item.instrument_id)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken/50"
                >
                  <td className="px-5 py-2.5">
                    <SeverityChip severity={item.severity} />
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <Link
                      to="/instruments/$instrumentId"
                      params={{ instrumentId: String(item.instrument_id) }}
                      search={isToday ? {} : { asOf }}
                      onClick={(e) => {
                        // Open beside the command view; a modified click still opens a new tab.
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                          e.preventDefault()
                          e.stopPropagation()
                          onOpen(item.instrument_id)
                        }
                      }}
                      className="block truncate font-medium text-ink hover:text-brand"
                    >
                      {item.title}
                    </Link>
                    <span className="mt-0.5 flex items-center gap-2 font-mono text-[0.6875rem] text-ink-3">
                      {item.number}{' '}
                      <StatusChip status={item.status} className="h-5 px-2 text-[0.6875rem]" />
                    </span>
                  </td>
                  <td className="max-w-[190px] truncate px-3 py-2.5 text-ink-2">
                    {item.institution}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Amount paise={item.amount_paise} compact />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-mono text-ink">{formatDate(item.due)}</span>
                    <span className="block text-[0.6875rem] text-ink-3">
                      {formatRelativeDays(item.due, asOf)}
                    </span>
                  </td>
                  <td className="hidden px-5 py-2.5 whitespace-nowrap text-ink-2 2xl:table-cell">
                    {item.owner ?? 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
