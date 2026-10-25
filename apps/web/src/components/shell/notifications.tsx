import * as Popover from '@radix-ui/react-popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell, BellOff } from 'lucide-react'

import { EmptyState } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

export function NotificationsBell() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => unwrap(await api.GET('/api/v1/notifications')),
    refetchInterval: 30_000,
  })
  const readAll = useMutation({
    mutationFn: async () => api.POST('/api/v1/notifications/read-all'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const unread = q.data?.unread ?? 0
  return (
    <Popover.Root onOpenChange={(open) => !open && unread && readAll.mutate()}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
          aria-label={`Notifications, ${unread} unread`}
        >
          <Bell className="size-[18px]" />
          {unread ? (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[400px] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-overlay)]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[0.875rem] font-semibold text-ink">Notifications</p>
            <span className="text-[0.75rem] text-ink-3">
              {unread ? `${unread} unread` : 'All read'}
            </span>
          </div>
          {!q.data?.items.length ? (
            <EmptyState
              icon={<BellOff />}
              title="Nothing yet"
              body="Reminders, bank responses and escalations appear here."
            />
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {q.data.items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'border-b border-line last:border-0',
                    !n.read && 'bg-accent-soft/40',
                  )}
                >
                  <Link to={n.link ?? '/'} className="block px-4 py-3 hover:bg-sunken/60">
                    <p className="text-[0.8125rem] font-medium text-ink">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[0.75rem] text-ink-2">{n.body}</p>
                    <p className="mt-1 text-[0.6875rem] text-ink-3">{formatDate(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
