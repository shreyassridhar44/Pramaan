import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AlertsPage, type AlertsSearch } from '@/features/alerts/alerts-page'

export const Route = createFileRoute('/_app/alerts')({
  staticData: { title: 'Alerts' },
  validateSearch: (s: Record<string, unknown>): AlertsSearch => ({
    tab: s.tab === 'escalations' ? 'escalations' : undefined,
    rule: typeof s.rule === 'string' ? s.rule : undefined,
    region: typeof s.region === 'string' ? s.region : undefined,
  }),
  component: Page,
})

function Page() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return <AlertsPage search={search} setSearch={(s) => void navigate({ search: s })} />
}
