import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BellRing, Siren, Smartphone } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Amount, Chip } from '@/components/signature/chips'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { useMeta } from '@/features/instruments/queries'
import { api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatCount, formatDate } from '@/lib/format'

import { Stairs } from './ladders'
import { MessagePreview } from './message-preview'

export type AlertsSearch = { tab?: 'reminders' | 'escalations'; rule?: string; region?: string }

const RULES = [
  { value: 'monitoring.reminders', label: 'Maturity reminder' },
  { value: 'monitoring.reconfirm', label: 'Re-confirmation due' },
  { value: 'monitoring.auto_renew', label: 'Automatic renewal notice' },
]
const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  in_app: 'In app',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}
const LEVEL_LABEL: Record<string, string> = {
  dealing_officer: 'Dealing officer',
  section_head: 'Section head',
  deputy_director: 'Deputy director',
  director: 'Director',
}

const selectClass =
  'h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[0.8125rem] text-ink'

/** What monitoring has sent and what is escalated now (PROTOTYPE.md 5.7). */
export function AlertsPage({
  search,
  setSearch,
}: {
  search: AlertsSearch
  setSearch: (s: AlertsSearch) => void
}) {
  const tab = search.tab ?? 'reminders'
  const meta = useMeta()
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Alerts" className="flex rounded-full bg-sunken p-1">
          {(
            [
              ['reminders', 'Reminders sent', <BellRing key="r" />],
              ['escalations', 'Escalations', <Siren key="e" />],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setSearch({ tab: key, region: search.region })}
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-full px-4 text-[0.8125rem] [&_svg]:size-4',
                tab === key ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-2',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        {tab === 'reminders' ? (
          <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
            Alert
            <select
              value={search.rule ?? ''}
              onChange={(e) => setSearch({ ...search, rule: e.target.value || undefined })}
              aria-label="Alert kind"
              className={selectClass}
            >
              <option value="">All kinds</option>
              {RULES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
          Region
          <select
            value={search.region ?? ''}
            onChange={(e) => setSearch({ ...search, region: e.target.value || undefined })}
            aria-label="Region"
            className={selectClass}
          >
            <option value="">All regions</option>
            {(meta.data?.regions ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-[0.75rem] text-ink-3">
          SMS and WhatsApp are simulated in this prototype; email goes to the demo mailbox.
        </p>
      </div>
      {tab === 'reminders' ? (
        <Reminders rule={search.rule} region={search.region} />
      ) : (
        <Escalations region={search.region} />
      )}
    </div>
  )
}

function Table({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <div
      className="max-h-[calc(100dvh-260px)] overflow-auto"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="w-full text-[0.8125rem]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left text-[0.6875rem] tracking-[0.04em] text-ink-3 uppercase [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th:first-child]:pl-5">
            {head}
          </tr>
        </thead>
        <tbody className="[&_td]:px-4 [&_td]:py-2 [&_td:first-child]:pl-5 [&_tr]:border-b [&_tr]:border-line [&_tr:last-child]:border-0">
          {children}
        </tbody>
      </table>
    </div>
  )
}

function Loading() {
  return (
    <div className="grid gap-2 p-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  )
}

function InstrumentLink({ id, number }: { id: number; number: string }) {
  return (
    <Link
      to="/instruments/$instrumentId"
      params={{ instrumentId: String(id) }}
      className="font-mono text-ink hover:text-brand"
    >
      {number}
    </Link>
  )
}

function Reminders({ rule, region }: { rule?: string; region?: string }) {
  const q = useQuery({
    queryKey: ['alerts', 'reminders', rule, region],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/alerts/reminders', {
          params: { query: { rule, region, limit: 500 } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  const [preview, setPreview] = useState<number | null>(null)
  return (
    <Panel className="overflow-hidden">
      <MessagePreview id={preview} onClose={() => setPreview(null)} />
      <PanelHeader
        title="Reminders sent"
        caption={
          q.data
            ? `${formatCount(q.data.length)} most recent, newest first. Each fires once per instrument and due date.`
            : 'Loading'
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<BellRing />} title="No reminders match these filters" />
      ) : (
        <>
          <div className="px-5 pb-4">
            <Stairs
              title="Reminder ladder"
              caption="Maturity reminders sent at each step before the date, from the configured rule"
              steps={[90, 60, 30, 15, 7, 0].map((o, i) => ({
                key: String(o),
                label: o ? `T-${o}` : 'T-0',
                sub: o ? `${o} days before` : 'on the date',
                count: q.data.filter((r) => r.rule === 'Maturity reminder' && r.offset_days === o)
                  .length,
                tone: [
                  'bg-board-a2',
                  'bg-board-a2',
                  'bg-board-due',
                  'bg-board-due',
                  'bg-saffron',
                  'bg-board-overdue',
                ][i]!,
              }))}
            />
          </div>
          <Table
            label="Reminders sent"
            head={
              <>
                <th>Instrument</th>
                <th>Institution</th>
                <th>Region</th>
                <th>Alert</th>
                <th>Channel</th>
                <th>Due</th>
                <th>Sent</th>
                <th>
                  <span className="sr-only">Message</span>
                </th>
              </>
            }
          >
            {q.data.map((r) => (
              <tr key={r.id} className="hover:bg-sunken/50">
                <td>
                  <InstrumentLink id={r.instrument_id} number={r.number} />
                </td>
                <td className="max-w-[280px] truncate text-ink">{r.institution}</td>
                <td className="text-ink-2">{r.region}</td>
                <td className="text-ink">
                  {r.rule}
                  {r.rule === 'Maturity reminder' ? (
                    <span className="text-ink-3">
                      {' '}
                      · {r.offset_days ? `${r.offset_days} d before` : 'on the maturity date'}
                    </span>
                  ) : null}
                </td>
                <td className="text-ink-2">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                <td className="font-mono whitespace-nowrap">{formatDate(r.due_on)}</td>
                <td className="font-mono whitespace-nowrap text-ink-2">
                  {r.sent_on ? formatDate(r.sent_on) : 'Queued'}
                </td>
                <td className="text-right">
                  {r.rule === 'Maturity reminder' ? (
                    <button
                      type="button"
                      onClick={() => setPreview(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[0.75rem] font-medium whitespace-nowrap text-ink-2 hover:border-ink-3 hover:text-ink"
                    >
                      <Smartphone className="size-3.5" /> See message
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Panel>
  )
}

function Escalations({ region }: { region?: string }) {
  const q = useQuery({
    queryKey: ['alerts', 'escalations', region],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/alerts/escalations', { params: { query: { region } } })),
    placeholderData: (prev) => prev,
  })
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Open escalations"
        caption={
          q.data
            ? `${formatCount(q.data.length)} deposits past maturity and not yet renewed or released, most overdue first. Computed for today by the escalation ladder.`
            : 'Loading'
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<Siren />} title="Nothing is escalated" />
      ) : (
        <>
          <div className="px-5 pb-4">
            <Stairs
              title="Escalation ladder"
              caption="Where each overdue deposit sits now; it climbs a step when nobody acts by the next date"
              steps={['dealing_officer', 'section_head', 'deputy_director', 'director'].map(
                (lv, i) => ({
                  key: lv,
                  label: lv
                    .split('_')
                    .map((w) => w[0]!.toUpperCase() + w.slice(1))
                    .join(' '),
                  sub: ['first owner', 'second step', 'third step', 'final step'][i]!,
                  count: q.data.filter((e) => e.level === lv).length,
                  tone: ['bg-board-due', 'bg-saffron', 'bg-board-overdue', 'bg-[var(--band-red)]'][
                    i
                  ]!,
                }),
              )}
            />
          </div>
          <Table
            label="Open escalations"
            head={
              <>
                <th>Instrument</th>
                <th>Institution</th>
                <th>Region</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Overdue</th>
                <th>Now with</th>
                <th>Next</th>
              </>
            }
          >
            {q.data.map((e) => (
              <tr key={e.instrument_id} className="hover:bg-sunken/50">
                <td>
                  <InstrumentLink id={e.instrument_id} number={e.number} />
                </td>
                <td className="max-w-[280px] truncate text-ink">{e.institution}</td>
                <td className="text-ink-2">{e.region}</td>
                <td className="text-right">
                  <Amount paise={e.amount_paise} />
                </td>
                <td className="text-right font-mono whitespace-nowrap text-overdue">
                  {e.days_overdue} d
                </td>
                <td>
                  <Chip tone={e.level === 'director' ? 'overdue' : 'due'} dot>
                    {LEVEL_LABEL[e.level] ?? e.level}
                  </Chip>
                </td>
                <td className="whitespace-nowrap text-ink-2">
                  {e.next_level && e.next_level_on
                    ? `${LEVEL_LABEL[e.next_level] ?? e.next_level} on ${formatDate(e.next_level_on)}`
                    : 'Top of the ladder'}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Panel>
  )
}
