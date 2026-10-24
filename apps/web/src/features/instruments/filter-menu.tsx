import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type Option = { value: string; label: ReactNode; hint?: ReactNode }

/** Multi-select filter as a chip with a popover of checkable options. */
export function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const active = selected.length > 0
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] transition-colors',
            active
              ? 'border-brand bg-brand text-brand-contrast'
              : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink',
          )}
        >
          {label}
          {active ? (
            <span className="rounded-full bg-brand-contrast/20 px-1.5 font-mono text-[0.6875rem]">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[360px] w-[280px] overflow-y-auto rounded-[var(--radius-panel)] border border-line bg-surface p-1.5 shadow-[var(--shadow-overlay)]"
        >
          <div role="group" aria-label={label}>
            {options.map((o) => {
              const on = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-ink hover:bg-sunken"
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded border',
                      on ? 'border-brand bg-brand text-brand-contrast' : 'border-line-strong',
                    )}
                  >
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint ? <span className="text-[0.75rem] text-ink-3">{o.hint}</span> : null}
                </button>
              )
            })}
          </div>
          {selected.length ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-brand hover:bg-sunken"
            >
              Clear {label.toLowerCase()}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
