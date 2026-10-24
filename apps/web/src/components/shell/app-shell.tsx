import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  ClipboardCheck,
  FileText,
  Gauge,
  Landmark,
  LogOut,
  Moon,
  Orbit,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  TableProperties,
  Unlock,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { AsOfControl } from '@/components/signature/as-of-control'
import { PramaanMark, Wordmark } from '@/components/signature/mark'
import { Kbd, Tip } from '@/components/ui/primitives'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { ROLE_LABEL, useMe, useSignOut } from '@/lib/session'
import { useTheme } from '@/lib/theme'

import { CommandPalette } from './command-palette'

type NavItem = { to: string; label: string; icon: LucideIcon; roles?: string[] }

const NAV: NavItem[] = [
  { to: '/', label: 'Command', icon: Gauge },
  { to: '/queue', label: 'Verification queue', icon: ClipboardCheck },
  { to: '/instruments', label: 'Instruments', icon: TableProperties },
  { to: '/institutions', label: 'Institutions', icon: Landmark },
  { to: '/releases', label: 'Releases', icon: Unlock },
  { to: '/forecast', label: 'Forecast', icon: Orbit },
  { to: '/letters', label: 'Letters', icon: FileText },
  { to: '/audit', label: 'Audit', icon: ScrollText },
  { to: '/admin/rules', label: 'Rules', icon: Settings2, roles: ['admin', 'section_head'] },
]

export function AppShell({ children, title }: { children: ReactNode; title?: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} onSearch={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 pt-5 pb-10">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

function Rail() {
  const me = useMe().data
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { asOf, isToday } = useAsOf()
  const items = NAV.filter((n) => !n.roles || (me && n.roles.includes(me.role)))
  return (
    <nav
      aria-label="Primary"
      className="group/rail sticky top-0 z-30 flex h-dvh w-16 shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 hover:w-[232px] focus-within:w-[232px]"
    >
      <Link
        to="/"
        search={isToday ? {} : { asOf }}
        className="flex h-14 items-center gap-3 overflow-hidden px-[18px]"
      >
        <PramaanMark size={28} />
        <Wordmark className="opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100" />
      </Link>
      <ul className="mt-2 flex flex-1 flex-col gap-0.5 px-2.5">
        {items.map((item) => {
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                search={isToday ? {} : { asOf }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-3 overflow-hidden rounded-[var(--radius-control)] px-[11px] text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-sunken text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-accent"
                  />
                ) : null}
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                <span className="opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="px-2.5 pb-3">
        <ThemeToggle />
      </div>
    </nav>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-10 w-full items-center gap-3 overflow-hidden rounded-[var(--radius-control)] px-[11px] text-[0.8125rem] font-medium text-ink-2 hover:bg-sunken hover:text-ink"
    >
      {theme === 'command' ? (
        <Sun className="size-[18px] shrink-0" />
      ) : (
        <Moon className="size-[18px] shrink-0" />
      )}
      <span className="whitespace-nowrap opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
        {theme === 'command' ? 'Ledger theme' : 'Command theme'}
      </span>
    </button>
  )
}

function TopBar({ title, onSearch }: { title?: ReactNode; onSearch: () => void }) {
  const me = useMe().data
  const signOut = useSignOut()
  const { isToday } = useAsOf()
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-canvas/90 px-6 backdrop-blur',
        isToday ? 'border-line' : 'border-accent',
      )}
    >
      <div className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{title}</div>
      <button
        type="button"
        onClick={onSearch}
        className="hidden h-9 w-[340px] items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-[0.8125rem] text-ink-3 hover:border-ink-3 md:flex"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate text-left">Search or jump to</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      {!isToday ? (
        <span className="hidden text-[0.75rem] font-medium text-accent lg:inline">
          Forecast view: nothing is saved
        </span>
      ) : null}
      <AsOfControl />
      {me ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 hover:bg-sunken"
            >
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-[0.8125rem] font-medium text-ink">{me.name}</span>
                <span className="block text-[0.6875rem] text-ink-3">
                  {ROLE_LABEL[me.role] ?? me.role}
                  {me.region_name ? `, ${me.region_name}` : ''}
                </span>
              </span>
              <span className="grid size-8 place-items-center rounded-full bg-brand text-[0.75rem] font-semibold text-brand-contrast">
                {me.name
                  .split(' ')
                  .filter((p) => /^[A-Z]/.test(p))
                  .slice(-2)
                  .map((p) => p[0])
                  .join('')}
              </span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[220px] rounded-[var(--radius-panel)] border border-line bg-surface p-1.5 shadow-[var(--shadow-overlay)]"
            >
              <div className="px-2.5 py-2">
                <p className="text-[0.8125rem] font-medium text-ink">{me.designation}</p>
                <p className="text-[0.75rem] text-ink-3">{me.email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={signOut}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-sunken data-[highlighted]:text-ink"
              >
                <LogOut className="size-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
      <Tip content="All amounts and records on this prototype are synthetic">
        <ShieldCheck className="size-4 text-ink-3" aria-label="Synthetic data" />
      </Tip>
    </header>
  )
}
