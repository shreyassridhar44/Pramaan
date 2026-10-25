import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Inbox, LogOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Amount } from '@/components/signature/chips'
import { PramaanMark } from '@/components/signature/mark'
import { EmptyState, ErrorState, Kbd, Panel, Skeleton } from '@/components/ui/primitives'
import { CaseView } from '@/features/releases/case-view'
import { CELL_NAME } from '@/features/releases/meta'
import { ClearanceDots } from '@/features/releases/release-list'
import { api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { homeFor, meQuery, useMe, useSignOut } from '@/lib/session'

export const Route = createFileRoute('/clearances')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/signin' })
    if (me.role !== 'cell_officer') throw redirect({ to: homeFor(me.role) })
  },
  component: ClearancesLayout,
})

function ClearancesLayout() {
  const me = useMe().data
  const signOut = useSignOut()
  const [tab, setTab] = useState<'pending' | 'decided'>('pending')
  const queue = useQuery({
    queryKey: ['clearances', tab],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/clearances', { params: { query: { state: tab } } })),
  })
  const items = useMemo(() => queue.data ?? [], [queue.data])
  const [selected, setSelected] = useState<number | null>(null)
  // A case just decided leaves the waiting list but stays open until the officer moves on.
  const current = selected ?? items[0]?.row.id ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [role=dialog]')) return
      const idx = items.findIndex((i) => i.row.id === current)
      if (e.key === 'j' && idx < items.length - 1) setSelected(items[idx + 1]!.row.id)
      if (e.key === 'k' && idx > 0) setSelected(items[idx - 1]!.row.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, current])

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-6">
          <PramaanMark size={32} />
          <span className="leading-tight">
            <span className="block text-[0.9375rem] font-semibold text-ink">
              {CELL_NAME[me?.cell ?? ''] ?? 'Clearance cell'}
            </span>
            <span className="block text-[0.75rem] text-ink-3">
              Clearance queue for release of security deposits
            </span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-right text-[0.8125rem] leading-tight">
              <span className="block font-medium text-ink">{me?.name}</span>
              <span className="block text-[0.75rem] text-ink-3">{me?.designation}</span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1480px] gap-5 px-6 py-6 xl:grid-cols-[380px_1fr]">
        <Panel className="overflow-hidden xl:sticky xl:top-6 xl:max-h-[calc(100dvh-48px)] xl:overflow-y-auto">
          <div className="flex items-center gap-1 border-b border-line p-2">
            {(['pending', 'decided'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t)
                  setSelected(null)
                }}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-[0.8125rem] font-medium',
                  tab === t ? 'bg-sunken text-ink' : 'text-ink-3 hover:text-ink',
                )}
              >
                {t === 'pending' ? 'Waiting for you' : 'Decided'}
                {t === 'pending' && queue.data && tab === 'pending' ? ` (${items.length})` : ''}
              </button>
            ))}
            <span className="ml-1 hidden items-center gap-1 text-[0.6875rem] text-ink-3 sm:flex">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
            </span>
          </div>
          {queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} compact />
          ) : queue.isPending ? (
            <div className="grid gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title={tab === 'pending' ? 'Nothing waiting for your cell' : 'No decisions yet'}
              body="Release cases appear here when an institution applies and your cell has not yet cleared or blocked them."
            />
          ) : (
            <ul role="listbox" aria-label="Clearance queue">
              {items.map(({ row: r, my_status, open_complaints }) => (
                <li key={r.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={r.id === current}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left hover:bg-sunken/60',
                      r.id === current && 'bg-accent-soft/60 shadow-[inset_3px_0_0_var(--accent)]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium text-ink">
                        {r.institution}
                      </span>
                      <span className="block font-mono text-[0.6875rem] text-ink-3">
                        {r.reference} · applied {formatDate(r.applied_on)}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <ClearanceDots clearances={r.clearances} />
                        {open_complaints ? (
                          <span className="text-[0.6875rem] font-medium text-due">
                            {open_complaints} open complaint{open_complaints > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {tab === 'decided' ? (
                          <span
                            className={cn(
                              'text-[0.6875rem] font-medium',
                              my_status === 'blocked' ? 'text-overdue' : 'text-a2',
                            )}
                          >
                            You {my_status}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <Amount paise={r.amount_paise} compact className="text-[0.8125rem]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div>{current ? <CaseView id={current} mode="cell" /> : null}</div>
      </main>
    </div>
  )
}
