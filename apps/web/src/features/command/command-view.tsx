import { useState } from 'react'

import { ProofGauge } from '@/components/charts/proof-gauge'
import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { Seal } from '@/components/security/seal'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { addDays, useAsOf } from '@/lib/asof'
import { formatCount, formatINRCompact } from '@/lib/format'

import { ActionDocket, Brief, ImpactDials, PulseMonitor, SignalCards } from './centre'
import { HeadlineFigure, RollingNumber } from './headline'
import { InstrumentSheet } from './instrument-sheet'
import { ExposuresList, RegionPanel } from './overview-panels'
import { useSummary } from './queries'
import { RiverPanel } from './river-panel'

/** The Regulation Bureau's command centre (PROTOTYPE.md 5.2, redrawn under DECISION D36). */
export function CommandView() {
  const [sheet, setSheet] = useState<number | null>(null)
  return (
    <div className="grid gap-6">
      <Brief />
      <div data-tour="board">
        <HeadlineBand />
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8" data-tour="river">
          <RiverPanel />
        </div>
        <div className="xl:col-span-4">
          <ProofPanel />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <RegionPanel />
        </div>
        <div className="xl:col-span-6">
          <ActionDocket onOpen={setSheet} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <SignalCards />
        </div>
        <div className="xl:col-span-7">
          <ImpactDials />
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
      <PulseMonitor />
    </div>
  )
}

function ProofPanel() {
  const { data, isPending, isError, error, refetch } = useSummary()
  const total = data ? Number(data.held_paise) : 0
  const share = (k: 'a0' | 'a1' | 'a2' | 'a3') =>
    data && total ? Number(data.by_assurance_paise[k]) / total : 0
  return (
    <Panel className="h-full">
      <PanelHeader
        title="How well the money is proven"
        caption="Share of value held, by assurance level"
      />
      <div className="px-5 pb-4">
        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} compact />
        ) : isPending || !data ? (
          <Skeleton className="h-[260px]" />
        ) : (
          <ProofGauge
            shares={{ a0: share('a0'), a1: share('a1'), a2: share('a2'), a3: share('a3') }}
          />
        )}
      </div>
      <ExposuresList />
    </Panel>
  )
}
