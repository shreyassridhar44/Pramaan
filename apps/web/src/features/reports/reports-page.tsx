import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Download, FileText, FileBarChart } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINR, formatINRCompact, formatPercent } from '@/lib/format'

type ReportOut = components['schemas']['ReportOut']
type Column = components['schemas']['ColumnOut']

function cell(value: unknown, kind: string): string {
  if (value === null || value === undefined || value === '') return ''
  switch (kind) {
    case 'money':
      return formatINR(String(value))
    case 'percent':
      return formatPercent(Number(value))
    case 'date':
      return formatDate(String(value))
    case 'count':
      return formatCount(Number(value))
    case 'days':
      return `${value} d`
    default:
      return String(value).replaceAll('_', ' ')
  }
}

function csv(report: ReportOut) {
  const raw = (v: unknown, c: Column) =>
    c.kind === 'money' ? (BigInt(String(v ?? 0)) / 100n).toString() : String(v ?? '')
  const header = report.columns.map((c) => (c.kind === 'money' ? `${c.label} (Rs)` : c.label))
  const lines = report.rows.map((r) =>
    report.columns.map((c) => `"${raw(r[c.key], c).replaceAll('"', '""')}"`).join(','),
  )
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${report.info.name}-${report.as_of}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Gallery of operational reports (PROTOTYPE.md 5.10), computed for the global as-of date. */
export function ReportsPage({ name, onPick }: { name?: string; onPick: (n: string) => void }) {
  const { asOf } = useAsOf()
  const [days, setDays] = useState(90)
  const catalogue = useQuery({
    queryKey: ['reports'],
    queryFn: async () => unwrap(await api.GET('/api/v1/reports')),
  })
  const current = name ?? catalogue.data?.[0]?.name
  const report = useQuery({
    queryKey: ['report', current, asOf, days],
    enabled: !!current,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/reports/{name}', {
          params: { path: { name: current! }, query: { as_of: asOf, days } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  const r = report.data
  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="grid content-start gap-2">
        {catalogue.isError ? (
          <ErrorState error={catalogue.error} compact />
        ) : catalogue.isPending ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          catalogue.data.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onPick(c.name)}
              aria-pressed={c.name === current}
              className={cn(
                'rounded-[var(--radius-panel)] border bg-surface p-4 text-left hover:border-ink-3',
                c.name === current
                  ? 'border-accent shadow-[inset_3px_0_0_var(--accent)]'
                  : 'border-line',
              )}
            >
              <span className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
                <FileBarChart className="size-4 text-ink-3" aria-hidden /> {c.title}
              </span>
              <span className="mt-1 block text-[0.75rem] text-ink-3">{c.description}</span>
            </button>
          ))
        )}
      </div>
      <Panel className="min-w-0 overflow-hidden">
        <PanelHeader
          title={r?.info.title ?? 'Report'}
          caption={
            r
              ? `${r.info.description} As of ${formatDate(r.as_of)}. ${formatCount(r.rows.length)} rows. Computed from synthetic data.`
              : 'Loading'
          }
          actions={
            r ? (
              <div className="flex flex-wrap items-center gap-2">
                {r.info.params.includes('days') ? (
                  <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
                    Within
                    <select
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[0.8125rem] text-ink"
                    >
                      {[30, 90, 180, 365].map((d) => (
                        <option key={d} value={d}>
                          {d} days
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Button size="sm" onClick={() => csv(r)} disabled={!r.rows.length}>
                  <Download /> CSV
                </Button>
                <Button size="sm" asChild>
                  <a
                    href={`/api/v1/reports/${r.info.name}/pdf?as_of=${asOf}&days=${days}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText /> PDF
                  </a>
                </Button>
              </div>
            ) : null
          }
        />
        {report.isError ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : !r ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : r.rows.length === 0 ? (
          <EmptyState icon={<FileBarChart />} title="Nothing to report for this date" />
        ) : (
          <>
            {'amount_paise' in r.totals || 'count' in r.totals ? (
              <div className="flex flex-wrap gap-6 border-y border-line bg-sunken/40 px-5 py-3 text-[0.8125rem]">
                <span className="text-ink-2">
                  Rows <span className="font-mono text-ink">{formatCount(r.rows.length)}</span>
                </span>
                {'amount_paise' in r.totals ? (
                  <span className="text-ink-2">
                    Total{' '}
                    <span className="font-mono text-ink">
                      {formatINRCompact(String(r.totals.amount_paise))}
                    </span>
                  </span>
                ) : null}
                {'count' in r.totals ? (
                  <span className="text-ink-2">
                    Items{' '}
                    <span className="font-mono text-ink">
                      {formatCount(Number(r.totals.count))}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <div
              className="max-h-[calc(100dvh-300px)] overflow-auto"
              tabIndex={0}
              role="region"
              aria-label={`${r.info.title} table`}
            >
              <table className="w-full text-[0.8125rem]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line text-left text-[0.6875rem] tracking-[0.04em] text-ink-3 uppercase">
                    {r.columns.map((c) => (
                      <th
                        key={c.key}
                        className={cn(
                          'px-4 py-2.5 font-medium first:pl-5',
                          ['money', 'count', 'days', 'percent'].includes(c.kind) && 'text-right',
                        )}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rows.slice(0, 500).map((row, i) => (
                    <tr key={i} className="border-b border-line last:border-0 hover:bg-sunken/50">
                      {r.columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            'px-4 py-2 first:pl-5',
                            ['money', 'count', 'days', 'percent'].includes(c.kind) &&
                              'text-right font-mono',
                            ['money', 'date', 'days'].includes(c.kind) && 'whitespace-nowrap',
                          )}
                        >
                          {c.key === 'number' && row.instrument_id ? (
                            <Link
                              to="/instruments/$instrumentId"
                              params={{ instrumentId: String(row.instrument_id) }}
                              className="font-mono text-ink hover:text-brand"
                            >
                              {String(row.number)}
                            </Link>
                          ) : (
                            cell(row[c.key], c.kind)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.rows.length > 500 ? (
                <p className="px-5 py-3 text-[0.75rem] text-ink-3">
                  Showing 500 of {formatCount(r.rows.length)} rows. Export CSV for all rows.
                </p>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
