import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Inbox } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AssuranceRing } from '@/components/signature/assurance'
import { type AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount, StatusChip } from '@/components/signature/chips'
import {
  EmptyState,
  ErrorState,
  Kbd,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/primitives'
import {
  ActionBar,
  CorrectableProvenance,
  DocumentsTab,
  SignalsPanel,
} from '@/features/instruments/officer-actions'
import { useInstrument } from '@/features/instruments/queries'
import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

const QUEUE_STATUSES = ['submitted', 'under_scrutiny', 'discrepancy', 'returned']

export function QueuePage() {
  const { asOf } = useAsOf()
  const list = useQuery({
    queryKey: ['instruments', 'queue', asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/instruments', {
          params: { query: { as_of: asOf, status: QUEUE_STATUSES, sort: '-maturity', limit: 200 } },
        }),
      ),
  })
  const items = [...(list.data?.items ?? [])].sort(
    (a, b) => b.open_signals - a.open_signals || b.id - a.id,
  )
  const [selected, setSelected] = useState<number | null>(null)
  const current = selected ?? items[0]?.id ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const idx = items.findIndex((i) => i.id === current)
      if (e.key === 'j' && idx < items.length - 1) setSelected(items[idx + 1]!.id)
      if (e.key === 'k' && idx > 0) setSelected(items[idx - 1]!.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, current])

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)] [&>*]:min-w-0">
      <Panel className="overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100dvh-110px)] xl:overflow-y-auto">
        <PanelHeader
          title="Waiting for scrutiny"
          caption={list.data ? `${list.data.total} items · signals first` : 'Loading'}
          actions={
            <span className="flex items-center gap-1 text-[0.6875rem] text-ink-3">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd> move
            </span>
          }
        />
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} compact />
        ) : list.isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="Queue clear"
            body="New submissions appear here as institutions file them."
          />
        ) : (
          <ul role="listbox" aria-label="Queue">
            {items.map((i) => (
              <li key={i.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i.id === current}
                  onClick={() => setSelected(i.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-t border-line px-5 py-3 text-left hover:bg-sunken/60',
                    i.id === current && 'bg-accent-soft/60 shadow-[inset_3px_0_0_var(--accent)]',
                  )}
                >
                  <AssuranceRing level={i.assurance as AssuranceLevel} size={22} showTip={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-ink">
                      {i.institution}
                    </span>
                    <span className="block font-mono text-[0.75rem] text-ink-3">{i.number}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <StatusChip status={i.status} className="h-5 px-2 text-[0.6875rem]" />
                      {i.open_signals ? (
                        <span className="text-[0.6875rem] font-medium text-overdue">
                          {i.open_signals} signal{i.open_signals > 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <Amount paise={i.amount_paise} compact className="text-[0.8125rem]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div>{current ? <QueueDetail id={current} /> : null}</div>
    </div>
  )
}

function QueueDetail({ id }: { id: number }) {
  const q = useInstrument(id)
  const { asOf, isToday } = useAsOf()
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} />
      </Panel>
    )
  if (!q.data) return <Skeleton className="h-[480px]" />
  const d = q.data
  return (
    <div className="grid gap-5">
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.8125rem] text-ink-3">
              {d.institution} · {d.region_name}
            </p>
            <p className="mt-0.5 font-mono text-[1.125rem] text-ink">{d.number}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-2">
              {d.bank} · submitted {formatDate(d.submitted_on)} · <Amount paise={d.amount_paise} />
            </p>
          </div>
          <Link
            to="/instruments/$instrumentId"
            params={{ instrumentId: String(d.id) }}
            search={isToday ? {} : { asOf }}
            className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand hover:underline"
          >
            Open full record <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-4">
          <ActionBar d={d} />
        </div>
      </Panel>
      <SignalsPanel d={d} />
      {d.documents.length ? <DocumentsTab d={d} stacked /> : null}
      <Panel>
        <PanelHeader title="Where every value comes from" />
        <CorrectableProvenance d={d} />
      </Panel>
    </div>
  )
}
