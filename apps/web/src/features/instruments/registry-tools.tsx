import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BellRing,
  Bookmark,
  Check,
  Columns3,
  Landmark,
  Trash2,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/primitives'
import { ApiError, api, unwrap } from '@/lib/api/client'
import { formatCount } from '@/lib/format'

import { useMeta } from './queries'

export type Column = { key: string; label: string; width: string; fixed?: boolean }

const menuClass =
  'z-50 min-w-[220px] rounded-[var(--radius-panel)] border border-line bg-surface p-1.5 shadow-[var(--shadow-overlay)]'
const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-sunken data-[highlighted]:text-ink'

/** Show or hide registry columns. The instrument number always stays. */
export function ColumnMenu({
  columns,
  hidden,
  onChange,
}: {
  columns: Column[]
  hidden: string[]
  onChange: (hidden: string[]) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" variant="ghost">
          <Columns3 /> Columns
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuClass}>
          {columns
            .filter((c) => !c.fixed)
            .map((c) => (
              <DropdownMenu.CheckboxItem
                key={c.key}
                checked={!hidden.includes(c.key)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) =>
                  onChange(on ? hidden.filter((k) => k !== c.key) : [...hidden, c.key])
                }
                className={itemClass}
              >
                <span className="grid size-4 place-items-center rounded border border-line-strong">
                  <DropdownMenu.ItemIndicator>
                    <Check className="size-3 text-ink" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {c.label}
              </DropdownMenu.CheckboxItem>
            ))}
          {hidden.length ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item onSelect={() => onChange([])} className={itemClass}>
                Show all columns
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export type SavedView<S> = { name: string; search: S }

/** Named filter sets kept in this browser for this officer. */
export function SavedViews<S>({
  views,
  onChange,
  current,
  onApply,
}: {
  views: SavedView<S>[]
  onChange: (v: SavedView<S>[]) => void
  current: S
  onApply: (s: S) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const save = () => {
    const n = name.trim()
    if (!n) return
    onChange([...views.filter((v) => v.name !== n), { name: n, search: current }])
    setName('')
    toast.success(`Saved the view "${n}".`)
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="ghost">
          <Bookmark /> Views{views.length ? ` (${views.length})` : ''}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-overlay)]">
          <Dialog.Title className="text-[1.0625rem] font-semibold text-ink">
            Saved views
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[0.875rem] text-ink-3">
            A view keeps the current filters and sort under a name. Views are kept in this browser
            for you only.
          </Dialog.Description>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example, Western maturing this quarter"
              aria-label="View name"
              maxLength={60}
            />
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              Save current
            </Button>
          </form>
          {views.length ? (
            <ul className="mt-4 grid gap-1" aria-label="Your views">
              {views.map((v) => (
                <li
                  key={v.name}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-sunken"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[0.875rem] text-ink"
                    onClick={() => {
                      onApply(v.search)
                      setOpen(false)
                    }}
                  >
                    {v.name}
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove the view ${v.name}`}
                    onClick={() => onChange(views.filter((x) => x.name !== v.name))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[0.8125rem] text-ink-3">No views saved yet.</p>
          )}
          <Dialog.Close
            className="absolute top-4 right-4 text-ink-3 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type BulkAction = 'request_confirmation' | 'remind' | 'assign'

/** One action over the selected rows. The server checks each instrument and says what it skipped. */
export function BulkBar({ ids, onDone }: { ids: number[]; onDone: () => void }) {
  const qc = useQueryClient()
  const meta = useMeta()
  const run = useMutation({
    mutationFn: async (v: { action: BulkAction; owner_id?: number }) =>
      unwrap(await api.POST('/api/v1/instruments/bulk', { body: { ids, ...v } })),
    onSuccess: (r) => {
      if (r.done) toast.success(r.message)
      else toast.info(r.message)
      void qc.invalidateQueries({ queryKey: ['instruments'] })
      void qc.invalidateQueries({ queryKey: ['instrument'] })
      onDone()
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  return (
    <div
      role="region"
      aria-label="Selected instruments"
      className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-5 py-2"
    >
      <span className="text-[0.8125rem] font-medium text-ink">
        {formatCount(ids.length)} selected
      </span>
      <Button
        size="sm"
        disabled={run.isPending}
        onClick={() => run.mutate({ action: 'request_confirmation' })}
      >
        <Landmark /> Request confirmation
      </Button>
      <Button size="sm" disabled={run.isPending} onClick={() => run.mutate({ action: 'remind' })}>
        <BellRing /> Send reminder
      </Button>
      <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
        <UserRoundCheck className="size-4" aria-hidden />
        <select
          value=""
          disabled={run.isPending}
          onChange={(e) =>
            e.target.value && run.mutate({ action: 'assign', owner_id: Number(e.target.value) })
          }
          aria-label="Assign to an officer"
          className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[0.8125rem] text-ink"
        >
          <option value="">Assign to</option>
          {(meta.data?.officers ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}>
        <X /> Clear selection
      </Button>
    </div>
  )
}
