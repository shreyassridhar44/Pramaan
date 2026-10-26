import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { GovFooter } from '@/components/shell/gov-footer'
import { GovStrip } from '@/components/shell/gov-strip'
import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
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
  { to: '/portal/release', label: 'Release', hi: 'वापसी' },
  { to: '/portal/letters', label: 'Letters', hi: 'पत्र' },
] as const

function PortalLayout() {
  const me = useMe().data
  const signOut = useSignOut()
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-[1rem]">
      <GovStrip compact />
      <header className="relative overflow-hidden bg-board text-board-ink">
        <RosetteMark
          seed="portal"
          className="pointer-events-none absolute -top-40 right-24 size-[380px]"
          color="rgb(255 255 255 / 0.06)"
        />
        <div className="relative mx-auto flex h-[72px] max-w-[1100px] items-center gap-6 px-6">
          <Link to="/portal" className="flex items-center gap-3">
            <PramaanMark size={38} />
            <span className="leading-tight">
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[1.375rem] leading-none">Pramaan</span>
                <span lang="hi" className="font-deva text-[0.75rem] text-saffron">
                  प्रमाण
                </span>
              </span>
              <span className="mt-0.5 block text-[0.6875rem] text-board-ink/60">
                AICTE institution portal
              </span>
            </span>
          </Link>
          <nav aria-label="Portal" className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  'flex flex-col items-center rounded-xl px-4 py-1.5 text-[0.875rem] leading-tight font-medium',
                  path === n.to
                    ? 'bg-white/10 text-white shadow-[inset_0_-2px_0_var(--saffron)]'
                    : 'text-board-ink/70 hover:bg-white/5 hover:text-white',
                )}
              >
                {n.label}
                <span lang="hi" aria-hidden className="font-deva text-[0.625rem] text-board-ink/70">
                  {n.hi}
                </span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-[0.875rem] font-medium">{me?.name}</span>
              <span className="block text-[0.75rem] text-board-ink/60">{me?.institution_name}</span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="grid size-9 place-items-center rounded-full text-board-ink/70 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <GuillocheBand height={10} color="rgb(255 153 51 / 0.4)" className="relative" />
      </header>
      <main id="main" className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
        <Outlet />
      </main>
      <GovFooter />
    </div>
  )
}
