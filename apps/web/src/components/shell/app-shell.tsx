import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  BellRing,
  ClipboardCheck,
  FileBarChart,
  FileSpreadsheet,
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
import { RosetteMark } from '@/components/security/guilloche'
import { SecurityThread } from '@/components/security/print'
import { PramaanMark } from '@/components/signature/mark'
import { Kbd, Tip } from '@/components/ui/primitives'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { ROLE_LABEL, useMe, useSignOut } from '@/lib/session'
import { useTheme } from '@/lib/theme'

import { CommandPalette } from './command-palette'
import { GovStrip } from './gov-strip'
import { NotificationsBell } from './notifications'

type NavItem = { to: string; label: string; hi: string; icon: LucideIcon; roles?: string[] }

const NAV: NavItem[] = [
  { to: '/', label: 'Command', hi: 'कमान', icon: Gauge },
  { to: '/queue', label: 'Verification queue', hi: 'सत्यापन', icon: ClipboardCheck },
  { to: '/instruments', label: 'Instruments', hi: 'प्रपत्र', icon: TableProperties },
  { to: '/institutions', label: 'Institutions', hi: 'संस्थान', icon: Landmark },
  { to: '/releases', label: 'Releases', hi: 'मुक्ति', icon: Unlock },
  { to: '/alerts', label: 'Alerts', hi: 'चेतावनी', icon: BellRing },
  { to: '/forecast', label: 'Forecast', hi: 'पूर्वानुमान', icon: Orbit },
  { to: '/reports', label: 'Reports', hi: 'रिपोर्ट', icon: FileBarChart },
  { to: '/letters', label: 'Letters', hi: 'पत्र', icon: FileText },
  { to: '/audit', label: 'Audit', hi: 'लेखापरीक्षा', icon: ScrollText },
  {
    to: '/admin/import',
    label: 'Legacy import',
    hi: 'पुरानी पंजी',
    icon: FileSpreadsheet,
    roles: ['bureau_officer', 'section_head', 'admin'],
  },
  {
    to: '/admin/rules',
    label: 'Rules',
    hi: 'नियम',
    icon: Settings2,
    roles: ['admin', 'section_head'],
  },
]

/** Hindi page titles shown beside the English ones, as on government portals. */
const TITLE_HI: Record<string, string> = {
  Command: 'कमान केंद्र',
  'Verification queue': 'सत्यापन कतार',
  Instruments: 'प्रपत्र पंजी',
  Instrument: 'प्रपत्र',
  Institutions: 'संस्थान',
  Institution: 'संस्थान',
  Releases: 'मुक्ति प्रकरण',
  'Release case': 'मुक्ति प्रकरण',
  Alerts: 'चेतावनी',
  Forecast: 'पूर्वानुमान',
  Reports: 'रिपोर्ट',
  Letters: 'पत्र',
  Audit: 'लेखापरीक्षा',
  Rules: 'नियम',
  'Legacy import': 'पुरानी पंजी का आयात',
}

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
    <div className="min-h-dvh bg-canvas">
      <GovStrip compact />
      <div className="flex">
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={title} onSearch={() => setPaletteOpen(true)} />
          <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-6 pt-5 pb-10">
            {children}
          </main>
        </div>
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
  // The rail never changes width under the pointer (DECISION D34): a rail that widens on hover
  // either pushes the page aside or covers its left edge, and both turn clicks into misses. Wide
  // screens show it open with labels; narrower ones show icons with their names as tooltips.
  return (
    <div className="w-16 shrink-0 xl:w-[232px]">
      <nav
        aria-label="Primary"
        className="sticky top-0 z-30 flex h-dvh w-16 flex-col overflow-hidden bg-board text-board-ink xl:w-[232px]"
      >
        <RosetteMark
          seed="rail"
          className="spin-slower pointer-events-none absolute -bottom-40 -left-32 size-[420px]"
          color="rgb(255 255 255 / 0.05)"
        />
        <Link
          to="/"
          search={isToday ? {} : { asOf }}
          className="relative flex h-16 items-center gap-3 overflow-hidden border-b border-white/10 px-[14px]"
        >
          <PramaanMark size={36} />
          <span className="hidden flex-col xl:flex">
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[1.375rem] leading-none">Pramaan</span>
              <span lang="hi" className="font-deva text-[0.75rem] text-saffron">
                प्रमाण
              </span>
            </span>
            <span className="mt-1 text-[0.5625rem] font-medium tracking-[0.14em] text-board-ink/50 uppercase">
              Regulation Bureau
            </span>
          </span>
        </Link>
        <ul className="relative mt-3 flex flex-1 flex-col gap-0.5 px-2.5">
          {items.map((item) => {
            const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  search={isToday ? {} : { asOf }}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    'relative flex h-10 items-center gap-3 overflow-hidden rounded-[var(--radius-control)] px-[11px] text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
                      : 'text-board-ink/65 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {active ? (
                    <SecurityThread className="absolute top-1.5 bottom-1.5 left-0" />
                  ) : null}
                  <item.icon
                    className={cn('size-[18px] shrink-0', active && 'text-saffron')}
                    aria-hidden
                  />
                  <span className="sr-only xl:not-sr-only">{item.label}</span>
                  <span
                    lang="hi"
                    aria-hidden
                    className="ml-auto hidden font-deva text-[0.6875rem] text-board-ink/30 xl:inline"
                  >
                    {item.hi}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="relative border-t border-white/10 px-2.5 pt-2 pb-3">
          <ThemeToggle />
        </div>
      </nav>
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === 'command' ? 'Ledger theme' : 'Command theme'}
      className="flex h-10 w-full items-center gap-3 overflow-hidden rounded-[var(--radius-control)] px-[11px] text-[0.8125rem] font-medium text-board-ink/65 hover:bg-white/[0.06] hover:text-white"
    >
      {theme === 'command' ? (
        <Sun className="size-[18px] shrink-0" />
      ) : (
        <Moon className="size-[18px] shrink-0" />
      )}
      <span className="sr-only whitespace-nowrap xl:not-sr-only">
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
        'sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-canvas/85 px-6 backdrop-blur-md',
        isToday ? 'border-line' : 'border-accent',
      )}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-3 truncate">
        <span className="truncate font-display text-[1.625rem] leading-none text-ink">{title}</span>
        {typeof title === 'string' && TITLE_HI[title] ? (
          <span lang="hi" className="hidden font-deva text-[0.875rem] text-ink-3 sm:inline">
            {TITLE_HI[title]}
          </span>
        ) : null}
      </div>
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
      <NotificationsBell />
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
