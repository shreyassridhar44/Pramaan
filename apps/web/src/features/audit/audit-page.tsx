import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Link2, ShieldCheck, ShieldX } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatCount } from '@/lib/format'

const ACTIONS = [
  ['', 'All actions'],
  ['instrument', 'Instrument lifecycle'],
  ['bank', 'Bank messages'],
  ['release', 'Release'],
  ['auth', 'Sign-ins'],
  ['audit', 'Audit checks'],
] as const

export function AuditPage() {
  const [action, setAction] = useState('')
  const log = useInfiniteQuery({
    queryKey: ['audit', action],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/audit', {
          params: { query: { action: action || undefined, before_id: pageParam, limit: 60 } },
        }),
      ),
    getNextPageParam: (last) =>
      last.items.length === 60 ? last.items[last.items.length - 1]!.id : undefined,
  })
  const rows = useMemo(() => log.data?.pages.flatMap((p) => p.items) ?? [], [log.data])
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Panel className="overflow-hidden xl:col-span-8">
        <PanelHeader
          title="Audit trail"
          caption={
            log.data
              ? `${formatCount(log.data.pages[0]!.total)} entries, newest first. Every entry is linked to the one before it by a SHA-256 hash.`
              : 'Loading'
          }
          actions={
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Filter by action"
              className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[0.8125rem]"
            >
              {ACTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          }
        />
        {log.isError ? (
          <ErrorState error={log.error} onRetry={() => void log.refetch()} />
        ) : log.isPending ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : (
          <div className="max-h-[calc(100dvh-220px)] overflow-y-auto">
            <table className="w-full text-[0.8125rem]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-y border-line text-left text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
                  <th className="px-5 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">When (UTC)</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-5 py-2 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-line hover:bg-sunken/50">
                    <td className="px-5 py-2 font-mono text-ink-3">{e.id}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap text-ink-2">
                      {e.at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2 font-mono text-ink">{e.action}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-ink-2">{e.actor}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap text-ink-3">
                      {e.entity_type}
                      {e.entity_id ? ` ${e.entity_id}` : ''}
                    </td>
                    <td className="px-5 py-2 font-mono text-[0.75rem] text-ink-3" title={e.hash}>
                      {e.hash.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {log.hasNextPage ? (
              <div className="p-4 text-center">
                <Button
                  size="sm"
                  onClick={() => void log.fetchNextPage()}
                  disabled={log.isFetchingNextPage}
                >
                  Load older entries
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
      <div className="xl:col-span-4">
        <ChainCheck latest={rows.slice(0, 6)} />
      </div>
    </div>
  )
}

function ChainCheck({
  latest,
}: {
  latest: { id: number; hash: string; prev_hash: string; action: string }[]
}) {
  const reduce = useReducedMotion()
  const verify = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/v1/audit/verify')),
  })
  const progress = useMotionValue(0)
  const counted = useTransform(progress, (v) => formatCount(Math.round(v)))
  const [doneFor, setDoneFor] = useState<unknown>(null)
  const done = verify.data !== undefined && doneFor === verify.data
  useEffect(() => {
    if (!verify.data) return
    const target = verify.data
    progress.set(0)
    const c = animate(progress, verify.data.checked, {
      duration: reduce ? 0 : 1.6,
      ease: [0.2, 0, 0, 1],
      onComplete: () => setDoneFor(target),
    })
    return () => c.stop()
  }, [verify.data, progress, reduce])
  const result = verify.data
  return (
    <Panel className="sticky top-20">
      <PanelHeader
        title="Verify the chain"
        caption="Recomputes every hash from the first entry. Any edit made outside the application breaks a link and is reported with the first bad entry."
      />
      <div className="px-5 pb-5">
        <ol className="grid gap-0">
          {[...latest].reverse().map((e, i, arr) => (
            <li key={e.id} className="relative">
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                  done && result?.valid ? 'border-a2/40 bg-a2-soft/40' : 'border-line bg-sunken/40',
                )}
              >
                <span className="font-mono text-[0.6875rem] text-ink-3">#{e.id}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-ink">
                  {e.action}
                </span>
                <span className="font-mono text-[0.6875rem] text-ink-3">{e.hash.slice(0, 8)}</span>
              </div>
              {i < arr.length - 1 ? (
                <span className="flex items-center gap-1.5 py-1 pl-4 font-mono text-[0.625rem] text-ink-3">
                  <Link2 className="size-3" aria-hidden /> prev {arr[i + 1]!.prev_hash.slice(0, 8)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => verify.mutate()}
          disabled={verify.isPending}
        >
          <ShieldCheck /> {verify.isPending ? 'Verifying' : 'Verify chain'}
        </Button>
        {verify.isError ? <ErrorState error={verify.error} compact /> : null}
        {result ? (
          <div className="mt-4 rounded-[var(--radius-panel)] border border-line p-4" role="status">
            <p className="font-display text-[2rem] leading-none text-ink">
              <motion.span>{counted}</motion.span>
              <span className="ml-2 font-sans text-[0.8125rem] text-ink-3">entries checked</span>
            </p>
            {done ? (
              result.valid ? (
                <p className="mt-2 flex items-center gap-2 text-[0.875rem] font-medium text-a2">
                  <ShieldCheck className="size-4" /> Every link is intact.
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-[0.875rem] font-medium text-overdue">
                  <ShieldX className="size-4" /> Broken at entry #{result.first_bad_id}:{' '}
                  {result.reason}
                </p>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
