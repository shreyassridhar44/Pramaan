import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ReportsPage } from '@/features/reports/reports-page'

export const Route = createFileRoute('/_app/reports')({
  staticData: { title: 'Reports' },
  validateSearch: (s: Record<string, unknown>): { name?: string } => ({
    name: typeof s.name === 'string' ? s.name : undefined,
  }),
  component: Page,
})

function Page() {
  const { name } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <ReportsPage
      name={name}
      onPick={(n) => void navigate({ search: (prev) => ({ ...prev, name: n }) })}
    />
  )
}
