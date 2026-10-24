import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { PramaanMark } from '@/components/signature/mark'
import { cn } from '@/lib/cn'
import { homeFor, meQuery, useMe, useSignOut } from '@/lib/session'

export const Route = createFileRoute('/portal')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/signin' })
    if (me.role !== 'institution_user') throw redirect({ to: homeFor(me.role) })
  },
  component: PortalLayout,
})

const NAV = [
  { to: '/portal', label: 'Home', hi: 'मुखपृष्ठ' },
  { to: '/portal/submit', label: 'Submit a deposit', hi: 'जमा प्रस्तुत करें' },
] as const

function PortalLayout() {
  const me = useMe().data
  const signOut = useSignOut()
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="min-h-dvh bg-canvas text-[1rem]">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-6 px-6">
          <Link to="/portal" className="flex items-center gap-3">
            <PramaanMark size={30} />
            <span className="leading-tight">
              <span className="block font-display text-[1.25rem] leading-none text-ink">
                Pramaan
              </span>
              <span className="block text-[0.6875rem] text-ink-3">AICTE institution portal</span>
            </span>
          </Link>
          <nav aria-label="Portal" className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  'rounded-full px-4 py-1.5 text-[0.875rem] font-medium',
                  path === n.to ? 'bg-sunken text-ink' : 'text-ink-2 hover:text-ink',
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-[0.875rem] font-medium text-ink">{me?.name}</span>
              <span className="block text-[0.75rem] text-ink-3">{me?.institution_name}</span>
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
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
