import { Link, useNavigate } from '@tanstack/react-router'
import { Unlock } from 'lucide-react'

import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { SplitFlap } from '@/components/security/split-flap'
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
        <Pipeline
          stations={[
            {
              label: 'Collecting clearances',
              hi: 'अनापत्ति',
              rows: collecting,
              tone: 'text-board-ink',
            },
            {
              label: 'Ready for authorisation',
              hi: 'प्राधिकरण हेतु तैयार',
              rows: ready,
              tone: 'text-board-a2',
            },
            {
              label: 'Authorised, awaiting bank',
              hi: 'बैंक की प्रतीक्षा',
              rows: authorised,
              tone: 'text-saffron',
            },
          ]}
          blocked={blocked}
          sum={sum}
        />
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

type Station = { label: string; hi: string; rows: ReleaseRow[]; tone: string }

/**
 * Release cases as a line with stations: clearances, then the competent authority, then the
 * bank's discharge. Cases blocked by a cell branch off the line in red. Every count is live.
 */
function Pipeline({
  stations,
  blocked,
  sum,
}: {
  stations: Station[]
  blocked: ReleaseRow[]
  sum: (xs: ReleaseRow[]) => bigint
}) {
  return (
    <section className="relative overflow-hidden rounded-[18px] bg-board text-board-ink shadow-[0_30px_60px_-40px_rgb(0_0_0/0.75)]">
      <RosetteMark
        seed="release-line"
        className="spin-slower pointer-events-none absolute -top-40 -right-32 size-[460px]"
        color="rgb(255 255 255 / 0.05)"
      />
      <GuillocheBand height={10} color="rgb(53 197 143 / 0.4)" />
      <div className="relative px-6 pt-4 pb-6">
        <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-board-ink/70 uppercase">
          Release line, Clause 6.46 · never automatic
        </p>
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          {/* The line joining the stations */}
          <svg
            className="absolute top-[22px] right-[16%] left-[16%] h-2 w-[68%]"
            preserveAspectRatio="none"
            viewBox="0 0 100 2"
            aria-hidden
          >
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="rgb(255 255 255 / 0.18)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="var(--saffron)"
              strokeWidth="2"
              strokeDasharray="3 10"
              className="flow-dash"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {stations.map((st, i) => (
            <div key={st.label} className="relative flex flex-col items-center text-center">
              <span className="relative grid size-11 place-items-center rounded-full border-2 border-board-ink/70 bg-board font-mono text-[0.8125rem] font-semibold">
                {i + 1}
                {st.rows.length ? (
                  <span className="absolute inset-0 animate-ping rounded-full border border-saffron/50 motion-reduce:animate-none" />
                ) : null}
              </span>
              <p className={cn('mt-3 font-display text-[2.75rem] leading-none', st.tone)}>
                <SplitFlap value={formatCount(st.rows.length)} variant="inline" />
              </p>
              <p className="mt-1 text-[0.8125rem] font-semibold">{st.label}</p>
              <p lang="hi" className="font-deva text-[0.75rem] text-board-ink/60">
                {st.hi}
              </p>
              <p className="mt-1 font-mono text-[0.75rem] text-board-ink/70">
                {formatINRCompact(sum(st.rows))}
              </p>
            </div>
          ))}
        </div>
        <div className="relative mt-5 flex items-center gap-4 rounded-[12px] border border-board-overdue/40 bg-board-overdue/10 px-4 py-3">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--band-red)] text-white">
            <Unlock className="size-4" />
            {blocked.length ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-board-overdue/40 motion-reduce:animate-none" />
            ) : null}
          </span>
          <p className="text-[0.875rem]">
            <span className="font-display text-[1.75rem] leading-none text-board-overdue">
              {formatCount(blocked.length)}
            </span>{' '}
            cases blocked by a cell ({formatINRCompact(sum(blocked))}). A block holds the case until
            the cell lifts it with a recorded reason.
          </p>
        </div>
      </div>
    </section>
  )
}
