import { createFileRoute, redirect } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { RosetteMark } from '@/components/security/guilloche'
import { SimulatedBadge } from '@/components/signature/chips'
import { BankDesk } from '@/features/bank/bank-desk'
import { homeFor, meQuery, useMe, useSignOut } from '@/lib/session'

export const Route = createFileRoute('/bank')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/signin' })
    if (me.role !== 'bank_officer') throw redirect({ to: homeFor(me.role) })
  },
  component: BankLayout,
})

function BankLayout() {
  const me = useMe().data
  const signOut = useSignOut()
  return (
    <div className="min-h-dvh bg-canvas">
      <div
        aria-hidden
        className="h-1.5 bg-[repeating-linear-gradient(135deg,var(--simulated)_0_10px,transparent_10px_20px)]"
      />
      <header className="relative overflow-hidden border-b border-line bg-surface">
        <RosetteMark
          seed={me?.bank_name ?? 'bank'}
          className="pointer-events-none absolute -top-28 left-40 size-[300px]"
          color="color-mix(in srgb, var(--simulated) 14%, transparent)"
        />
        <div className="relative mx-auto flex h-[72px] max-w-[1280px] items-center gap-4 px-6">
          <span className="grid size-11 place-items-center rounded-full bg-[var(--band-violet)] font-semibold text-white ring-4 ring-simulated-soft">
            {me?.bank_name
              ?.split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
          </span>
          <span className="leading-tight">
            <span className="block text-[0.9375rem] font-semibold text-ink">{me?.bank_name}</span>
            <span className="block text-[0.75rem] text-ink-3">
              Deposit confirmation desk for AICTE requests
            </span>
          </span>
          <SimulatedBadge label="Simulated bank" />
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
      <main className="mx-auto max-w-[1280px] px-6 py-6">
        <p className="mb-5 max-w-3xl text-[0.8125rem] text-ink-3">
          This desk stands in for a bank's own system in the prototype. Answers are taken from the
          simulated bank's records and signed with the bank's key. Pramaan verifies every signature
          before using a value.
        </p>
        <BankDesk />
      </main>
    </div>
  )
}
