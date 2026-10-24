import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Building2, Search, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount, Chip, StatusChip } from '@/components/signature/chips'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  Label,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'
import { formatCount, formatDate, formatINRCompact } from '@/lib/format'
import { Registry } from '@/features/instruments/registry'

const DISCIPLINE: Record<string, string> = {
  engineering_technology: 'Engineering and Technology',
  planning: 'Planning',
  applied_arts_crafts: 'Applied Arts and Crafts',
  design: 'Design',
  hmct: 'Hotel Management and Catering Technology',
  computer_applications: 'Computer Applications',
  management: 'Management',
}
const LEVEL: Record<string, string> = {
  diploma: 'Diploma',
  ug: 'Under Graduate',
  pg: 'Post Graduate',
}

function MixBar({ mix, total }: { mix: Record<string, string>; total: number }) {
  return (
    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-sunken" aria-hidden>
      {([3, 2, 1, 0] as AssuranceLevel[]).map((l) => (
        <div
          key={l}
          style={{
            width: `${total ? (Number(mix[`a${l}`]) / total) * 100 : 0}%`,
            background: ASSURANCE[l].color,
          }}
        />
      ))}
    </div>
  )
}

export function InstitutionsList() {
  const { asOf, isToday } = useAsOf()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text)
      setPage(0)
    }, 250)
    return () => clearTimeout(t)
  }, [text])
  const limit = 50
  const list = useQuery({
    queryKey: ['institutions', q, page, asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/institutions', {
          params: { query: { q: q || undefined, offset: page * limit, limit, as_of: asOf } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  return (
    <div className="grid gap-4">
      <label className="relative flex h-9 w-[360px] items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Name, AICTE permanent ID or city"
          aria-label="Search institutions"
          className="h-9 w-full rounded-full border border-line-strong bg-surface pr-3 pl-9 text-[0.8125rem] placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none"
        />
      </label>
      <Panel className="overflow-hidden">
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<SearchX />} title="No institutions match" />
        ) : (
          <>
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line bg-sunken/60 text-left text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
                  <th className="px-5 py-2 font-medium">Institution</th>
                  <th className="px-3 py-2 font-medium">AICTE ID</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 text-right font-medium">Held</th>
                  <th className="px-3 py-2 font-medium">Proof</th>
                  <th className="px-3 py-2 text-right font-medium">Open items</th>
                  <th className="px-5 py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-sunken/50">
                    <td className="max-w-[340px] px-5 py-2.5">
                      <Link
                        to="/institutions/$institutionId"
                        params={{ institutionId: String(i.id) }}
                        search={isToday ? {} : { asOf }}
                        className="block truncate font-medium text-ink hover:text-brand"
                      >
                        {i.name}
                      </Link>
                      <span className="text-[0.6875rem] text-ink-3">
                        {i.ownership === 'private'
                          ? 'Private'
                          : i.ownership === 'government'
                            ? 'Government'
                            : 'Government-aided'}{' '}
                        · {i.premises === 'leased' ? 'Leased premises' : 'Own premises'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-ink-2">{i.aicte_id}</td>
                    <td className="px-3 py-2.5 text-ink-2">
                      {i.city}, {i.state}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {Number(i.held_paise) ? (
                        <Amount paise={i.held_paise} compact />
                      ) : (
                        <span className="text-ink-3">None</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <MixBar mix={i.by_assurance_paise} total={Number(i.held_paise)} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {i.open_items || <span className="text-ink-3">0</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="flex gap-1.5">
                        {i.flags.complaint_open ? <Chip tone="due">Complaint open</Chip> : null}
                        {i.flags.dispute_lien ? <Chip tone="overdue">Trustee dispute</Chip> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[0.8125rem] text-ink-3">
              <span>{formatCount(list.data.total)} institutions, largest holdings first</span>
              <span className="flex gap-2">
                <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  disabled={(page + 1) * limit >= list.data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </span>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}

export function InstitutionProfile({ id }: { id: number }) {
  const { asOf, isToday } = useAsOf()
  const q = useQuery({
    queryKey: ['institution', id, asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/institutions/{institution_id}', {
          params: { path: { institution_id: id }, query: { as_of: asOf } },
        }),
      ),
  })
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (q.isPending)
    return (
      <Panel className="p-6">
        <Skeleton className="h-40 w-full" />
      </Panel>
    )
  const d = q.data
  const openComplaints = d.complaints.filter((c) => c.status === 'open')
  return (
    <div className="grid gap-5">
      <Link
        to="/institutions"
        search={isToday ? {} : { asOf }}
        className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Institutions
      </Link>
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 place-items-center rounded-xl bg-sunken text-ink-2">
              <Building2 className="size-6" />
            </span>
            <div>
              <h1 className="text-[1.375rem] font-semibold text-ink">{d.name}</h1>
              <p className="mt-0.5 text-[0.875rem] text-ink-2">
                {d.trust_name} · {d.city}, {d.state} · {d.region_name}
              </p>
              <p className="mt-1 font-mono text-[0.75rem] text-ink-3">
                AICTE ID {d.aicte_id} · established {d.established_year}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>
                  {d.ownership === 'private'
                    ? 'Private'
                    : d.ownership === 'government'
                      ? 'Government'
                      : 'Government-aided'}
                </Chip>
                <Chip>{d.premises === 'leased' ? 'Leased premises' : 'Own premises'}</Chip>
                {openComplaints.length ? (
                  <Chip tone="due">
                    {openComplaints.length} complaint{openComplaints.length > 1 ? 's' : ''} open
                    with PGRC
                  </Chip>
                ) : null}
                {d.flags.dispute_lien ? (
                  <Chip tone="overdue">Trustee dispute: AICTE lien held</Chip>
                ) : null}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Label>Held in trust</Label>
            <p className="mt-1 font-display text-[2.5rem] leading-none text-ink">
              {formatINRCompact(d.held_paise)}
            </p>
            <p className="mt-1 text-[0.75rem] text-ink-3">
              {d.held_count} instrument{d.held_count === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          <PanelHeader
            title="Security deposit for current programmes"
            caption={`${d.demand_preview.aph_ref}, rule version ${d.demand_preview.rule_version}. Shown as if applying today.`}
          />
          {d.demand_preview.exempt ? (
            <p className="px-5 pb-5 text-[0.875rem] text-ink-2">
              Exempt: {d.demand_preview.exemption_reason}.
            </p>
          ) : (
            <>
              <ul className="px-5 text-[0.8125rem]">
                {d.demand_preview.lines.map((l, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-0"
                  >
                    <span className="text-ink">
                      {DISCIPLINE[l.discipline] ?? l.discipline}, {LEVEL[l.level] ?? l.level}
                      <span className="block text-[0.75rem] text-ink-3">
                        Table 1.4: <Amount paise={l.base_paise} compact />
                        {l.multiplier > 1 ? ` × ${l.multiplier} (${l.note.toLowerCase()})` : ''}
                      </span>
                    </span>
                    <Amount paise={l.amount_paise} />
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-line px-5 py-3 text-[0.875rem] font-semibold">
                <span>Total</span>
                <Amount paise={d.demand_preview.total_paise} />
              </div>
            </>
          )}
        </Panel>
        <Panel className="xl:col-span-5">
          <PanelHeader title="Complaints and release cases" />
          <ul className="px-5 pb-4 text-[0.8125rem]">
            {d.complaints.slice(0, 5).map((c) => (
              <li
                key={c.reference}
                className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{c.category}</span>
                  <span className="font-mono text-[0.6875rem] text-ink-3">
                    {c.reference} · opened {formatDate(c.opened_on)}
                  </span>
                </span>
                {c.status === 'open' ? (
                  <Chip tone="due">
                    <AlertTriangle className="size-3" /> Open
                  </Chip>
                ) : (
                  <Chip>Closed</Chip>
                )}
              </li>
            ))}
            {d.release_cases.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
              >
                <span className="font-mono text-ink">
                  {r.reference}
                  <span className="block font-sans text-[0.6875rem] text-ink-3">
                    applied {formatDate(r.applied_on)}
                  </span>
                </span>
                <StatusChip
                  status={
                    r.status === 'closed'
                      ? 'released'
                      : r.status === 'authorised'
                        ? 'release_cleared'
                        : 'release_requested'
                  }
                />
              </li>
            ))}
            {!d.complaints.length && !d.release_cases.length ? (
              <li className="py-3 text-ink-3">None recorded.</li>
            ) : null}
          </ul>
        </Panel>
      </div>

      <div>
        <h2 className="mb-3 text-[0.9375rem] font-semibold text-ink">Instruments</h2>
        <Registry search={{ sort: 'maturity' }} setSearch={() => undefined} institutionId={id} />
      </div>
    </div>
  )
}
