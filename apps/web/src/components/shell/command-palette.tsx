import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { ArrowRight, Landmark, Moon, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'
import { formatINRCompact } from '@/lib/format'
import { useTheme } from '@/lib/theme'

const PAGES = [
  { to: '/', label: 'Command view' },
  { to: '/queue', label: 'Verification queue' },
  { to: '/instruments', label: 'Instrument registry' },
  { to: '/institutions', label: 'Institutions' },
  { to: '/releases', label: 'Release cases' },
  { to: '/forecast', label: 'Forecast timeline' },
  { to: '/letters', label: 'Letters' },
  { to: '/audit', label: 'Audit trail' },
]

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim(), 180)
  const navigate = useNavigate()
  const { asOf, isToday } = useAsOf()
  const { toggle } = useTheme()

  const instruments = useQuery({
    queryKey: ['palette', 'instruments', term, asOf],
    enabled: open && term.length >= 2,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/instruments', {
          params: { query: { q: term, limit: 6, include_closed: true, as_of: asOf } },
        }),
      ),
  })
  const institutions = useQuery({
    queryKey: ['palette', 'institutions', term],
    enabled: open && term.length >= 2,
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/institutions', { params: { query: { q: term, limit: 5 } } })),
  })

  const go = (to: string) => {
    onOpenChange(false)
    setQ('')
    void navigate({ to, search: isToday ? {} : { asOf } })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[14vh] left-1/2 z-50 w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-overlay)]"
        >
          <Dialog.Title className="sr-only">Search and commands</Dialog.Title>
          <div className="relative overflow-hidden bg-board px-4 py-2 text-board-ink">
            <GuillocheBand
              height={6}
              color="rgb(255 153 51 / 0.45)"
              className="absolute inset-x-0 top-0"
            />
            <p className="flex items-center justify-between pt-1 text-[0.625rem] font-semibold tracking-[0.16em] text-board-ink/70 uppercase">
              <span>
                Search Pramaan{' '}
                <span lang="hi" className="font-deva tracking-normal normal-case">
                  खोजें
                </span>
              </span>
              <span>Ctrl K</span>
            </p>
          </div>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-ink-3" aria-hidden />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="FDR number, institution name or AICTE ID, or a page"
                className="h-12 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
              />
            </div>
            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-[0.8125rem] text-ink-3">
                {term.length < 2 ? 'Type at least two characters.' : 'Nothing matches.'}
              </Command.Empty>
              {instruments.data?.items.length ? (
                <Command.Group heading="Instruments" className="palette-group">
                  {instruments.data.items.map((i) => (
                    <Command.Item
                      key={i.id}
                      value={`i-${i.id}`}
                      onSelect={() => go(`/instruments/${i.id}`)}
                      className="palette-item"
                    >
                      <RosetteMark
                        seed={i.number}
                        layers={2}
                        className="size-5"
                        color="color-mix(in srgb, var(--brand) 55%, transparent)"
                      />
                      <span className="font-mono text-[0.8125rem]">{i.number}</span>
                      <span className="truncate text-ink-2">{i.institution}</span>
                      <span className="ml-auto font-mono text-[0.75rem] text-ink-3">
                        {formatINRCompact(i.amount_paise)}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {institutions.data?.items.length ? (
                <Command.Group heading="Institutions" className="palette-group">
                  {institutions.data.items.map((i) => (
                    <Command.Item
                      key={i.id}
                      value={`n-${i.id}`}
                      onSelect={() => go(`/institutions/${i.id}`)}
                      className="palette-item"
                    >
                      <Landmark className="size-4 text-ink-3" />
                      <span className="truncate">{i.name}</span>
                      <span className="ml-auto font-mono text-[0.75rem] text-ink-3">
                        {i.aicte_id}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading="Go to" className="palette-group">
                {PAGES.filter(
                  (p) => !term || p.label.toLowerCase().includes(term.toLowerCase()),
                ).map((p) => (
                  <Command.Item
                    key={p.to}
                    value={`p-${p.to}`}
                    onSelect={() => go(p.to)}
                    className="palette-item"
                  >
                    <ArrowRight className="size-4 text-ink-3" />
                    {p.label}
                  </Command.Item>
                ))}
                <Command.Item
                  value="theme"
                  onSelect={() => {
                    toggle()
                    onOpenChange(false)
                  }}
                  className="palette-item"
                >
                  <Moon className="size-4 text-ink-3" /> Switch theme
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
          <div className="flex items-center gap-4 border-t border-line bg-sunken/60 px-4 py-2 text-[0.6875rem] text-ink-3">
            <span>
              <kbd className="rounded border border-line-strong px-1 font-mono">Up</kbd>{' '}
              <kbd className="rounded border border-line-strong px-1 font-mono">Down</kbd> move
            </span>
            <span>
              <kbd className="rounded border border-line-strong px-1 font-mono">Enter</kbd> open
            </span>
            <span>
              <kbd className="rounded border border-line-strong px-1 font-mono">Esc</kbd> close
            </span>
            <span className="ml-auto">Searches the records you are allowed to see</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
