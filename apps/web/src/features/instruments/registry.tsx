import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownUp, Download, Rows3, Rows4, Search, SearchX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount, StatusChip } from '@/components/signature/chips'
import { STATUS } from '@/components/signature/status-meta'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Panel, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINRCompact, formatRelativeDays } from '@/lib/format'

import { AskBar } from './ask-bar'
import { FilterMenu } from './filter-menu'
import { useMeta } from './queries'

type Row = components['schemas']['InstrumentRow']
export type RegistrySearch = {
  q?: string
  region?: string[]
  bank?: string[]
  kind?: string[]
  status?: string[]
  assurance?: number[]
  maturity_from?: string
  maturity_to?: string
  has_signals?: boolean
  sort?: string
}

const KIND_LABEL: Record<string, string> = { joint_fdr: 'Joint FDR', rpgf: 'RPGF', rtgs: 'RTGS' }

const PAGE = 200
const HELD_STATUSES = [
  'submitted',
  'under_scrutiny',
  'discrepancy',
  'returned',
  'active',
  'maturing',
  'matured',
  'release_requested',
  'release_cleared',
  'lien_hold',
]
const SORTS: { value: string; label: string }[] = [
  { value: 'maturity', label: 'Maturity, soonest first' },
  { value: '-maturity', label: 'Maturity, latest first' },
  { value: '-amount', label: 'Amount, largest first' },
  { value: 'assurance', label: 'Assurance, weakest first' },
  { value: 'institution', label: 'Institution name' },
]

export function Registry({
  search,
  setSearch,
  institutionId,
}: {
  search: RegistrySearch
  setSearch: (s: RegistrySearch) => void
  /** When set, shows every instrument of one institution (including closed ones) without filters. */
  institutionId?: number
}) {
  const { asOf, isToday } = useAsOf()
  const meta = useMeta()
  const navigate = useNavigate()
  const [dense, setDense] = useState(false)
  const [text, setText] = useState(search.q ?? '')
  // Keep the box in step when the search changes from outside (the Ask bar, a link).
  useEffect(() => setText(search.q ?? ''), [search.q])
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? '') !== text) setSearch({ ...search, q: text || undefined })
    }, 250)
    return () => clearTimeout(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = {
    as_of: asOf,
    q: search.q,
    region: search.region,
    bank: search.bank,
    status: search.status,
    assurance: search.assurance,
    kind: search.kind,
    maturity_from: search.maturity_from,
    maturity_to: search.maturity_to,
    has_signals: search.has_signals,
    sort: (search.sort ?? 'maturity') as 'maturity',
    limit: PAGE,
    institution_id: institutionId,
    include_closed: institutionId ? true : undefined,
  }
  const list = useInfiniteQuery({
    queryKey: ['instruments', query],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/instruments', {
          params: { query: { ...query, offset: pageParam } },
        }),
      ),
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
    placeholderData: (prev) => prev,
  })
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data])
  const first = list.data?.pages[0]

  const parentRef = useRef<HTMLDivElement>(null)
  const rowHeight = dense ? 40 : 52
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns fresh functions by design; this component does not rely on memoising them.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })
  const items = virtualizer.getVirtualItems()
  useEffect(() => {
    const last = items[items.length - 1]
    if (last && last.index >= rows.length - 20 && list.hasNextPage && !list.isFetchingNextPage) {
      void list.fetchNextPage()
    }
  }, [items, rows.length, list])

  const filtersActive = Boolean(
    search.q ||
    search.region?.length ||
    search.bank?.length ||
    search.status?.length ||
    search.assurance?.length ||
    search.kind?.length ||
    search.maturity_from ||
    search.maturity_to ||
    search.has_signals !== undefined,
  )
  const extra: { label: string; clear: RegistrySearch }[] = [
    ...(search.kind ?? []).map((k) => ({
      label: KIND_LABEL[k] ?? k,
      clear: { ...search, kind: search.kind!.filter((x) => x !== k) },
    })),
    ...(search.maturity_from
      ? [
          {
            label: `Matures from ${formatDate(search.maturity_from)}`,
            clear: { ...search, maturity_from: undefined },
          },
        ]
      : []),
    ...(search.maturity_to
      ? [
          {
            label: `Matures by ${formatDate(search.maturity_to)}`,
            clear: { ...search, maturity_to: undefined },
          },
        ]
      : []),
    ...(search.has_signals !== undefined
      ? [
          {
            label: search.has_signals ? 'Has open signals' : 'No open signals',
            clear: { ...search, has_signals: undefined },
          },
        ]
      : []),
  ]

  const exportCsv = async () => {
    const all: Row[] = []
    for (let offset = 0; ; offset += 500) {
      const page = unwrap(
        await api.GET('/api/v1/instruments', {
          params: { query: { ...query, limit: 500, offset } },
        }),
      )
      all.push(...page.items)
      if (offset + page.items.length >= page.total) break
    }
    const header = [
      'Instrument number',
      'Institution',
      'Region',
      'Bank',
      'Amount (Rs)',
      'Issue date',
      'Maturity date',
      'Status',
      'Assurance',
      'Open signals',
      'Owner',
    ]
    const lines = all.map((r) =>
      [
        r.number,
        r.institution,
        r.region,
        r.bank,
        (BigInt(r.amount_paise) / 100n).toString(),
        r.issue_date,
        r.maturity_date,
        r.status,
        ASSURANCE[r.assurance as AssuranceLevel].name,
        r.open_signals,
        r.owner ?? '',
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pramaan-instruments-${asOf}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="grid gap-4">
      {institutionId ? null : <AskBar search={search} onApply={setSearch} />}
      <div className={cn('flex flex-wrap items-center gap-2', institutionId && 'hidden')}>
        <label className="relative flex h-9 w-[320px] items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" aria-hidden />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Instrument number, institution or AICTE ID"
            aria-label="Search instruments"
            className="h-9 w-full rounded-full border border-line-strong bg-surface pr-3 pl-9 text-[0.8125rem] text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none"
          />
        </label>
        <FilterMenu
          label="Region"
          options={(meta.data?.regions ?? []).map((r) => ({ value: r.code, label: r.name }))}
          selected={search.region ?? []}
          onChange={(v) => setSearch({ ...search, region: v.length ? v : undefined })}
        />
        <FilterMenu
          label="Bank"
          options={(meta.data?.banks ?? []).map((b) => ({
            value: b.code,
            label: b.name,
            hint: b.code,
          }))}
          selected={search.bank ?? []}
          onChange={(v) => setSearch({ ...search, bank: v.length ? v : undefined })}
        />
        <FilterMenu
          label="Status"
          options={HELD_STATUSES.map((s) => ({ value: s, label: STATUS[s]?.label ?? s }))}
          selected={search.status ?? []}
          onChange={(v) => setSearch({ ...search, status: v.length ? v : undefined })}
        />
        <FilterMenu
          label="Assurance"
          options={([0, 1, 2, 3] as AssuranceLevel[]).map((l) => ({
            value: String(l),
            label: (
              <span className="inline-flex items-center gap-2">
                <AssuranceRing level={l} size={14} showTip={false} /> {ASSURANCE[l].name}
              </span>
            ),
          }))}
          selected={(search.assurance ?? []).map(String)}
          onChange={(v) =>
            setSearch({ ...search, assurance: v.length ? v.map(Number) : undefined })
          }
        />
        {extra.map((x) => (
          <span
            key={x.label}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft pr-1 pl-3 text-[0.8125rem] text-ink"
          >
            {x.label}
            <button
              type="button"
              onClick={() => setSearch(x.clear)}
              className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
              aria-label={`Remove ${x.label}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {filtersActive ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText('')
              setSearch({ sort: search.sort })
            }}
          >
            <X /> Clear all
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-[0.8125rem] text-ink-3">
            <ArrowDownUp className="size-4" aria-hidden />
            <select
              value={search.sort ?? 'maturity'}
              onChange={(e) => setSearch({ ...search, sort: e.target.value })}
              className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[0.8125rem] text-ink"
              aria-label="Sort"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setDense((d) => !d)}
            aria-label={dense ? 'Comfortable rows' : 'Compact rows'}
          >
            {dense ? <Rows3 /> : <Rows4 />}
          </Button>
          <Button size="sm" onClick={() => void exportCsv()} disabled={!first?.total}>
            <Download /> Export CSV
          </Button>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
          <div className="text-[0.8125rem] text-ink-2">
            {first ? (
              <>
                <span className="font-semibold text-ink">{formatCount(first.total)}</span>{' '}
                instruments,{' '}
                <span className="font-mono text-ink">{formatINRCompact(first.total_paise)}</span>
                {!isToday ? <span className="text-accent"> as of {formatDate(asOf)}</span> : null}
              </>
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </div>
          <p className="text-[0.75rem] text-ink-3">
            Statuses and assurance computed for the selected date
          </p>
        </div>
        <div role="table" aria-label="Instruments" aria-rowcount={(first?.total ?? 0) + 1}>
          <div role="rowgroup">
            <div
              role="row"
              aria-rowindex={1}
              className="grid grid-cols-[1.25fr_2.2fr_0.9fr_1.1fr_1fr_1.1fr_1.15fr_0.7fr_1fr] items-center gap-3 border-b border-line bg-sunken/60 px-5 py-2 text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase"
            >
              <span role="columnheader">Instrument</span>
              <span role="columnheader">Institution</span>
              <span role="columnheader">Region</span>
              <span role="columnheader">Bank</span>
              <span role="columnheader" className="text-right">
                Amount
              </span>
              <span role="columnheader">Maturity</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Proof</span>
              <span role="columnheader">Owner</span>
            </div>
          </div>
          {rows.length > 0 && !list.isError ? (
            <div
              ref={parentRef}
              role="rowgroup"
              className={cn(
                'overflow-y-auto',
                institutionId ? 'max-h-[420px]' : 'h-[calc(100dvh-280px)] min-h-[420px]',
              )}
            >
              <div
                role="presentation"
                style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
              >
                {items.map((vi) => {
                  const r = rows[vi.index]!
                  return (
                    <Link
                      key={r.id}
                      to="/instruments/$instrumentId"
                      params={{ instrumentId: String(r.id) }}
                      search={isToday ? {} : { asOf }}
                      role="row"
                      aria-rowindex={vi.index + 2}
                      onKeyDown={(e) =>
                        e.key === ' ' &&
                        void navigate({
                          to: '/instruments/$instrumentId',
                          params: { instrumentId: String(r.id) },
                        })
                      }
                      className={cn(
                        'absolute inset-x-0 grid grid-cols-[1.25fr_2.2fr_0.9fr_1.1fr_1fr_1.1fr_1.15fr_0.7fr_1fr] items-center gap-3 border-b border-line px-5 text-[0.8125rem] hover:bg-sunken/60 focus-visible:bg-accent-soft focus-visible:outline-none',
                      )}
                      style={{ top: vi.start, height: rowHeight }}
                    >
                      <span role="cell" className="truncate font-mono text-ink">
                        {r.number}
                        {r.open_signals ? (
                          <span
                            className="ml-2 inline-grid size-5 place-items-center rounded-full bg-overdue-soft font-sans text-[0.6875rem] font-semibold text-overdue"
                            aria-label={`${r.open_signals} open signals`}
                          >
                            {r.open_signals}
                          </span>
                        ) : null}
                      </span>
                      <span role="cell" className="truncate text-ink">
                        {r.institution}
                      </span>
                      <span role="cell" className="truncate text-ink-2">
                        {meta.data?.regions
                          .find((x) => x.code === r.region)
                          ?.name.replace(/ Region| \(camp office\)/, '') ?? r.region}
                      </span>
                      <span role="cell" className="truncate text-ink-2">
                        {r.bank}
                      </span>
                      <span role="cell" className="text-right">
                        <Amount paise={r.amount_paise} />
                      </span>
                      <span role="cell" className="leading-tight">
                        <span className="block font-mono text-ink">
                          {formatDate(r.maturity_date)}
                        </span>
                        {!dense ? (
                          <span
                            className={cn(
                              'block text-[0.6875rem]',
                              r.days_to_maturity < 0
                                ? 'text-overdue'
                                : r.days_to_maturity <= 90
                                  ? 'text-due'
                                  : 'text-ink-3',
                            )}
                          >
                            {formatRelativeDays(r.maturity_date, asOf)}
                          </span>
                        ) : null}
                      </span>
                      <span role="cell">
                        <StatusChip status={r.status} />
                      </span>
                      <span role="cell">
                        <AssuranceRing level={r.assurance as AssuranceLevel} size={22} />
                      </span>
                      <span role="cell" className="truncate text-ink-2">
                        {r.owner ?? 'Unassigned'}
                      </span>
                    </Link>
                  )
                })}
              </div>
              {list.isFetchingNextPage ? (
                <p className="py-3 text-center text-[0.75rem] text-ink-3">Loading more</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No instruments match these filters"
            body="Try removing a filter or searching by the instrument number."
          />
        ) : null}
      </Panel>
    </div>
  )
}
