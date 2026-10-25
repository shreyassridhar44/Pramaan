import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  CircleDot,
  GitCommitVertical,
  Link2,
  ShieldAlert,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount, Chip, SimulatedBadge, StatusChip } from '@/components/signature/chips'
import {
  EmptyState,
  ErrorState,
  Label,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { eventDetail, eventLabel } from '@/lib/events'
import { formatDate, formatINR, formatRelativeDays } from '@/lib/format'

import { BankTab } from './bank-tab'
import {
  ActionBar,
  CorrectableProvenance,
  DocumentsTab,
  ObservationsPanel,
  SignalsPanel,
} from './officer-actions'
import { useInstrument } from './queries'

type Detail = components['schemas']['InstrumentDetail']

const KIND_LABEL: Record<string, string> = {
  joint_fdr: 'Joint FDR',
  rpgf: 'RPGF',
  rtgs: 'RTGS deposit',
}
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

export function InstrumentDetailPage({ id }: { id: number }) {
  const q = useInstrument(id)
  const { asOf, isToday } = useAsOf()
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (q.isPending) return <DetailSkeleton />
  const d = q.data
  const level = d.assurance as AssuranceLevel
  const conflicts = d.provenance.filter((p) => p.state === 'conflict').length
  return (
    <div className="grid gap-5">
      <Link
        to="/instruments"
        search={isToday ? {} : { asOf }}
        className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Instruments
      </Link>

      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{KIND_LABEL[d.kind] ?? d.kind}</Chip>
              <StatusChip status={d.status} />
              {d.escalation ? (
                <Chip tone="overdue">Escalated to {d.escalation.replaceAll('_', ' ')}</Chip>
              ) : null}
              {d.bank_simulated ? <SimulatedBadge /> : null}
            </div>
            <h1 className="mt-3 font-mono text-[1.375rem] font-medium tracking-tight text-ink">
              {d.number}
            </h1>
            <p className="mt-1 text-[0.9375rem] text-ink-2">
              <Link
                to="/institutions/$institutionId"
                params={{ institutionId: String(d.institution_id) }}
                search={isToday ? {} : { asOf }}
                className="font-medium text-ink hover:text-brand"
              >
                {d.institution}
              </Link>
              <span className="text-ink-3">
                {' '}
                · {d.trust_name} · {d.region_name}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <Label>Amount</Label>
                <p className="mt-1 font-display text-[2.75rem] leading-none text-ink">
                  {formatINR(d.amount_paise)}
                </p>
              </div>
              <Fact label="Bank" value={`${d.bank}, ${d.branch}`} sub={d.ifsc} />
              <Fact
                label="Matures"
                value={formatDate(d.maturity_date)}
                sub={formatRelativeDays(d.maturity_date, asOf)}
                tone={
                  d.days_to_maturity < 0 ? 'overdue' : d.days_to_maturity <= 90 ? 'due' : undefined
                }
              />
              <Fact
                label="Owner"
                value={d.owner ?? 'Unassigned'}
                sub={d.next_action ?? 'No action due'}
              />
            </div>
            <div className="mt-5">
              <ActionBar d={d} />
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-[var(--radius-panel)] border border-line bg-sunken/50 px-6 py-5 lg:w-[340px]">
            <AssuranceRing level={level} size={92} animate />
            <div>
              <Label>Assurance</Label>
              <p className={cn('mt-1 text-[1.25rem] font-semibold', ASSURANCE[level].text)}>
                {ASSURANCE[level].short} {ASSURANCE[level].name}
              </p>
              <p className="mt-1 text-[0.75rem] leading-snug text-ink-3">
                {ASSURANCE[level].explain}
              </p>
              {conflicts ? (
                <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] font-medium text-overdue">
                  <ShieldAlert className="size-3.5" /> {conflicts} field{conflicts > 1 ? 's' : ''}{' '}
                  in conflict
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      <Tabs.Root defaultValue="overview">
        <Tabs.List className="flex gap-1 border-b border-line" aria-label="Instrument sections">
          {[
            ['overview', 'Overview'],
            ['documents', 'Documents'],
            ['bank', 'Bank'],
            ['timeline', 'Timeline'],
            ['audit', 'Audit'],
          ].map(([v, label]) => (
            <Tabs.Trigger
              key={v}
              value={v!}
              className="relative -mb-px h-10 px-4 text-[0.8125rem] font-medium text-ink-3 hover:text-ink data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-accent"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview" className="mt-5 grid gap-5 xl:grid-cols-12">
          <div className="grid gap-5 xl:col-span-8">
            <Panel>
              <PanelHeader
                title="Where every value comes from"
                caption="Declared, extracted and bank-confirmed values are stored separately and compared field by field"
              />
              <CorrectableProvenance d={d} />
            </Panel>
            <SignalsPanel d={d} />
            <ObservationsPanel d={d} />
          </div>
          <div className="grid content-start gap-5 xl:col-span-4">
            <KeyDates d={d} />
            <ChainPanel d={d} />
            {d.demand ? <DemandPanel demand={d.demand} /> : null}
          </div>
        </Tabs.Content>

        <Tabs.Content value="documents" className="mt-5">
          <DocumentsTab d={d} />
        </Tabs.Content>

        <Tabs.Content value="bank" className="mt-5">
          <BankTab d={d} />
        </Tabs.Content>

        <Tabs.Content value="timeline" className="mt-5">
          <TimelinePanel d={d} />
        </Tabs.Content>

        <Tabs.Content value="audit" className="mt-5">
          <AuditForInstrument id={d.id} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function Fact({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'due' | 'overdue'
}) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className="mt-1 truncate text-[0.9375rem] font-medium text-ink">{value}</p>
      {sub ? (
        <p
          className={cn(
            'mt-0.5 truncate font-mono text-[0.75rem]',
            tone === 'overdue' ? 'text-overdue' : tone === 'due' ? 'text-due' : 'text-ink-3',
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  )
}

function KeyDates({ d }: { d: Detail }) {
  const { asOf } = useAsOf()
  return (
    <Panel>
      <PanelHeader title="Key dates" caption="Reminder ladder from the configured rules" />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-4 text-[0.8125rem]">
        {[
          ['Issued', d.issue_date],
          ['Submitted', d.submitted_on],
          ['Verified', d.verified_on],
          ['Matures', d.maturity_date],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-mono text-ink">{v ? formatDate(v) : 'Not yet'}</dd>
          </div>
        ))}
      </dl>
      <ol className="border-t border-line px-5 py-3">
        {d.reminders.map((r) => (
          <li
            key={`${r.offset_days}-${r.due_on}`}
            className="flex items-center gap-3 py-1.5 text-[0.8125rem]"
          >
            <CircleDot
              className={cn(
                'size-3.5',
                r.status === 'sent'
                  ? 'text-a2'
                  : r.status === 'scheduled'
                    ? 'text-ink-3'
                    : 'text-line-strong',
              )}
              aria-hidden
            />
            <span className="w-24 font-mono text-ink-2">
              {r.overdue ? `+${-r.offset_days} days` : `T-${r.offset_days}`}
            </span>
            <span className="flex-1 font-mono text-ink">{formatDate(r.due_on)}</span>
            <span className="text-[0.75rem] text-ink-3">
              {r.status === 'sent'
                ? 'Sent'
                : r.status === 'scheduled'
                  ? formatRelativeDays(r.due_on, asOf)
                  : 'Before records'}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function ChainPanel({ d }: { d: Detail }) {
  const { asOf, isToday } = useAsOf()
  if (d.chain.length <= 1) return null
  return (
    <Panel>
      <PanelHeader title="Renewal chain" caption="Predecessors and successors of this deposit" />
      <ol className="px-5 pb-4">
        {d.chain.map((c, i) => (
          <li key={c.id} className="relative flex gap-3 pb-3 last:pb-0">
            {i < d.chain.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-5 bottom-0 left-[7px] w-px bg-line-strong"
              />
            ) : null}
            <Link2
              className={cn('mt-0.5 size-4 shrink-0', c.id === d.id ? 'text-accent' : 'text-ink-3')}
              aria-hidden
            />
            <div className="min-w-0 text-[0.8125rem]">
              {c.id === d.id ? (
                <span className="font-mono font-medium text-ink">{c.number} (this one)</span>
              ) : (
                <Link
                  to="/instruments/$instrumentId"
                  params={{ instrumentId: String(c.id) }}
                  search={isToday ? {} : { asOf }}
                  className="font-mono text-brand hover:underline"
                >
                  {c.number}
                </Link>
              )}
              <p className="text-[0.75rem] text-ink-3">
                {formatDate(c.issue_date)} to {formatDate(c.maturity_date)} ·{' '}
                <Amount paise={c.amount_paise} compact />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function DemandPanel({ demand }: { demand: NonNullable<Detail['demand']> }) {
  return (
    <Panel>
      <PanelHeader title="Linked demand" caption={demand.aph_ref} />
      <ul className="px-5 pb-2 text-[0.8125rem]">
        {demand.lines.map((l, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-0"
          >
            <span className="text-ink-2">
              {DISCIPLINE[l.discipline] ?? l.discipline}, {LEVEL[l.level] ?? l.level}
              <span className="block text-[0.75rem] text-ink-3">{l.note}</span>
            </span>
            <Amount paise={l.amount_paise} />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[0.8125rem]">
        <span className="text-ink-3">
          Intimated {formatDate(demand.intimated_on)}, furnished{' '}
          {demand.furnished_on ? formatDate(demand.furnished_on) : 'not yet'}
        </span>
        <Amount paise={demand.amount_paise} className="font-semibold" />
      </div>
    </Panel>
  )
}

function TimelinePanel({ d }: { d: Detail }) {
  if (!d.timeline.length)
    return (
      <Panel>
        <EmptyState icon={<CalendarDays />} title="No events on or before this date" />
      </Panel>
    )
  return (
    <Panel>
      <PanelHeader title="Lifecycle" caption="Every recorded event, oldest first" />
      <ol className="px-5 pb-5">
        {d.timeline.map((e, i) => (
          <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
            {i < d.timeline.length - 1 ? (
              <span aria-hidden className="absolute top-6 bottom-0 left-[9px] w-px bg-line" />
            ) : null}
            <GitCommitVertical className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.875rem] text-ink">{eventLabel(e.type)}</p>
              <p className="font-mono text-[0.75rem] text-ink-3">
                {formatDate(e.on)}
                {e.actor ? ` · ${e.actor}` : ''}
              </p>
              {eventDetail(e.type, e.payload) ? (
                <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                  {eventDetail(e.type, e.payload)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function AuditForInstrument({ id }: { id: number }) {
  const q = useQuery({
    queryKey: ['audit', 'instrument', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/audit', {
          params: { query: { entity_type: 'instrument', entity_id: id, limit: 100 } },
        }),
      ),
  })
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} compact />
      </Panel>
    )
  if (q.isPending)
    return (
      <Panel>
        <div className="p-5">
          <Skeleton className="h-24 w-full" />
        </div>
      </Panel>
    )
  return (
    <Panel>
      <PanelHeader title="Audit entries" caption="From the hash-chained audit log" />
      <ul className="px-5 pb-4">
        {q.data.items.map((e) => (
          <li
            key={e.id}
            className="grid grid-cols-[140px_1fr_auto] items-center gap-4 border-b border-line py-2.5 text-[0.8125rem] last:border-0"
          >
            <span className="font-mono text-ink-3">{e.at.slice(0, 10)}</span>
            <span className="truncate text-ink">
              {eventLabel(e.action)} <span className="text-ink-3">· {e.actor}</span>
            </span>
            <span className="font-mono text-[0.6875rem] text-ink-3">{e.hash.slice(0, 12)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-4 w-24" />
      <Panel className="p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-7 w-72" />
        <Skeleton className="mt-6 h-12 w-96" />
      </Panel>
      <Panel className="p-6">
        <Skeleton className="h-64 w-full" />
      </Panel>
    </div>
  )
}
