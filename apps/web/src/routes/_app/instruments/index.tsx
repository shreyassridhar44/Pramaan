import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Registry, type RegistrySearch } from '@/features/instruments/registry'

const isoDate = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined

const list = (v: unknown) =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : undefined

export const Route = createFileRoute('/_app/instruments/')({
  staticData: { title: 'Instruments' },
  validateSearch: (s: Record<string, unknown>): RegistrySearch & { asOf?: string } => ({
    asOf: typeof s.asOf === 'string' ? s.asOf : undefined,
    // The router parses values as JSON, so an all-digit instrument number arrives as a number.
    q: (typeof s.q === 'string' || typeof s.q === 'number') && s.q !== '' ? String(s.q) : undefined,
    region: list(s.region),
    bank: list(s.bank),
    status: list(s.status),
    assurance: list(s.assurance)
      ?.map(Number)
      .filter((n) => n >= 0 && n <= 3),
    sort: typeof s.sort === 'string' ? s.sort : undefined,
    kind: list(s.kind),
    maturity_from: isoDate(s.maturity_from),
    maturity_to: isoDate(s.maturity_to),
    has_signals: typeof s.has_signals === 'boolean' ? s.has_signals : undefined,
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
