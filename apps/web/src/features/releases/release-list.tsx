import { Link, useNavigate } from '@tanstack/react-router'
import { Unlock } from 'lucide-react'

import { Amount, Chip } from '@/components/signature/chips'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINRCompact } from '@/lib/format'

import { CASE_STATUS, CELLS, KIND_LABEL } from './meta'
import { type ReleaseRow, useReleases } from './queries'

type State = 'open' | 'closed'

export function ReleaseList({ state }: { state: State }) {
  const q = useReleases(state)
  const navigate = useNavigate()
  const rows = q.data ?? []
  const ready = rows.filter((r) => r.ready)
  const blocked = rows.filter((r) => r.blocked || r.status === 'blocked')
  const authorised = rows.filter((r) => r.status === 'authorised')
  const collecting = rows.filter((r) => r.status === 'in_clearance' && !r.ready && !r.blocked)
  const sum = (xs: ReleaseRow[]) => xs.reduce((a, r) => a + BigInt(r.amount_paise), 0n)
  return (
    <div className="grid gap-5">
      {state === 'open' ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Ready for authorisation"
            count={ready.length}
            amount={sum(ready)}
            tone="ok"
          />
          <Tile label="Collecting clearances" count={collecting.length} amount={sum(collecting)} />
          <Tile
            label="Blocked by a cell"
            count={blocked.length}
            amount={sum(blocked)}
            tone="overdue"
          />
          <Tile
            label="Authorised, awaiting bank"
            count={authorised.length}
            amount={sum(authorised)}
            tone="brand"
          />
        </div>
      ) : null}
      <Panel className="overflow-hidden">
        <PanelHeader
          title={state === 'open' ? 'Open release cases' : 'Closed release cases'}
          caption="Clause 6.46: term complete, documents, three clearances, then the competent authority"
          actions={
            <div className="flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1">
              {(['open', 'closed'] as const).map((s) => (
                <Link
                  key={s}
                  to="/releases"
                  search={{ state: s }}
                  className={cn(
                    'rounded-md px-3 py-1 text-[0.8125rem] font-medium',
                    state === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {s === 'open' ? 'Open' : 'Closed'}
                </Link>
              ))}
            </div>
          }
        />
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Unlock />}
            title={state === 'open' ? 'No open release cases' : 'No closed cases yet'}
            body="Institutions apply for release from the portal after a deposit completes its term."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-y border-line bg-sunken/40 text-left text-[0.6875rem] tracking-[0.04em] text-ink-3 uppercase">
                  <th className="px-5 py-2.5 font-medium">Case</th>
                  <th className="px-3 py-2.5 font-medium">Institution</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Clearances</th>
                  <th className="px-3 py-2.5 font-medium">Conditions</th>
                  <th className="px-3 py-2.5 font-medium">Applied</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortRows(rows).map((r) => (
                  <tr
                    key={r.id}
                    onClick={() =>
                      void navigate({
                        to: '/releases/$caseId',
                        params: { caseId: String(r.id) },
                      })
                    }
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken/50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to="/releases/$caseId"
                        params={{ caseId: String(r.id) }}
                        className="font-mono text-ink hover:text-brand"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.reference}
                      </Link>
                      <span className="block text-[0.6875rem] text-ink-3">
                        {KIND_LABEL[r.kind] ?? r.kind}
                        {r.instruments > 1 ? ` · ${r.instruments} deposits` : ''}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-3 py-3">
                      <span className="block truncate text-ink">{r.institution}</span>
                      <span className="block text-[0.6875rem] text-ink-3">{r.region}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Amount paise={r.amount_paise} compact />
                    </td>
                    <td className="px-3 py-3">
                      <ClearanceDots clearances={r.clearances} />
                    </td>
                    <td className="px-3 py-3">
                      <Progress
                        passed={r.checks_passed}
                        total={r.checks_total}
                        blocked={r.blocked}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                      {formatDate(r.applied_on)}
                      <span className="block font-mono text-[0.6875rem] text-ink-3">
                        {r.days_open} d
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <CaseChip row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

/** Ready cases first (they need the authority), then blocked, then the longest waiting. */
function sortRows(rows: ReleaseRow[]) {
  const rank = (r: ReleaseRow) => (r.ready ? 0 : r.blocked ? 1 : r.status === 'authorised' ? 3 : 2)
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.days_open - a.days_open)
}

export function CaseChip({ row }: { row: ReleaseRow }) {
  const s = row.ready
    ? CASE_STATUS.cleared!
    : (CASE_STATUS[row.status] ?? { label: row.status, tone: 'neutral' as const })
  return (
    <Chip tone={s.tone} dot>
      {s.label}
    </Chip>
  )
}

export function ClearanceDots({ clearances }: { clearances: Record<string, string> }) {
  return (
    <span className="flex gap-1.5">
      {CELLS.map((c) => {
        const st = clearances[c.key] ?? 'pending'
        return (
          <span
            key={c.key}
            title={`${c.label}: ${st}`}
            className={cn(
              'inline-flex h-5 items-center rounded px-1.5 text-[0.625rem] font-semibold tracking-wide uppercase',
              st === 'cleared' && 'bg-a2-soft text-a2',
              st === 'blocked' && 'bg-overdue-soft text-overdue',
              st === 'pending' && 'bg-sunken text-ink-3',
            )}
          >
            {c.short}
          </span>
        )
      })}
    </span>
  )
}

function Progress({ passed, total, blocked }: { passed: number; total: number; blocked: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex w-20 gap-0.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i < passed ? 'bg-a2' : blocked ? 'bg-overdue/40' : 'bg-line-strong',
            )}
          />
        ))}
      </span>
      <span className="font-mono text-[0.6875rem] text-ink-3">
        {passed}/{total}
      </span>
    </span>
  )
}

function Tile({
  label,
  count,
  amount,
  tone,
}: {
  label: string
  count: number
  amount: bigint
  tone?: 'ok' | 'overdue' | 'brand'
}) {
  return (
    <Panel className="p-4">
      <p className="text-[0.75rem] text-ink-3">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-[2rem] leading-none',
          tone === 'ok' && 'text-a2',
          tone === 'overdue' && 'text-overdue',
          tone === 'brand' && 'text-accent',
          !tone && 'text-ink',
        )}
      >
        {formatCount(count)}
      </p>
      <p className="mt-1 font-mono text-[0.75rem] text-ink-3">{formatINRCompact(amount)}</p>
    </Panel>
  )
}
