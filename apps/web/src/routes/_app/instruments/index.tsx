import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Registry, type RegistrySearch } from '@/features/instruments/registry'

const list = (v: unknown) =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : undefined

export const Route = createFileRoute('/_app/instruments/')({
  staticData: { title: 'Instruments' },
  validateSearch: (s: Record<string, unknown>): RegistrySearch & { asOf?: string } => ({
    asOf: typeof s.asOf === 'string' ? s.asOf : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    region: list(s.region),
    bank: list(s.bank),
    status: list(s.status),
    assurance: list(s.assurance)
      ?.map(Number)
      .filter((n) => n >= 0 && n <= 3),
    sort: typeof s.sort === 'string' ? s.sort : undefined,
  }),
  component: InstrumentsPage,
})

function InstrumentsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <Registry
      search={search}
      setSearch={(next) => void navigate({ search: { ...next, asOf: search.asOf }, replace: true })}
    />
  )
}
