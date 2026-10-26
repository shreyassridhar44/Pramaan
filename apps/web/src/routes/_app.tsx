import { createFileRoute, Outlet, redirect, useMatches } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/app-shell'
import { homeFor, meQuery, OFFICER_ROLES } from '@/lib/session'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    title?: string
  }
}

/** Officer application layout: requires a signed-in officer, otherwise sends people home. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/home' })
    if (!OFFICER_ROLES.has(me.role)) throw redirect({ to: homeFor(me.role) })
    return { me }
  },
  component: Layout,
})

function Layout() {
  const matches = useMatches()
  const title = [...matches].reverse().find((m) => m.staticData?.title)?.staticData?.title
  return (
    <AppShell title={title}>
      <Outlet />
    </AppShell>
  )
}
