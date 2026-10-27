import { useNavigate } from '@tanstack/react-router'
import { Clock3, Table2, Waves } from 'lucide-react'
import { Suspense, lazy, useState } from 'react'

import { MaturityClock } from '@/components/charts/maturity-clock'
import { RIVER_BANDS, bandValue, byMonth } from '@/components/charts/river-bands'
import { RiverLegend } from '@/components/charts/river-legend'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { useAsOf } from '@/lib/asof'
import { formatINRCompact } from '@/lib/format'

import { useRiver } from './queries'

// ECharts is only needed for the river view; the default clock view loads without it.
const MaturityRiver = lazy(() =>
  import('@/components/charts/maturity-river').then((m) => ({ default: m.MaturityRiver })),
)

function monthEnd(first: string) {
  const d = new Date(`${first}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1, 0)
  return d.toISOString().slice(0, 10)
}

/** Value maturing per month over 24 months by proof level; a week click lists its deposits. */
export function RiverPanel() {
  const { asOf, isToday } = useAsOf()
  const navigate = useNavigate()
  const q = useRiver(asOf)
  const [view, setView] = useState<'clock' | 'river' | 'table'>('clock')
  const table = view === 'table'
  const months = byMonth(q.data ?? [])
  const busy = months.filter((m) => m.count > 0)
  return (
    <Panel className="h-full">
      <PanelHeader
        title="What matures when"
        caption="24 months around a dial from twelve o'clock; bank-confirmed money at the core. Click a month."
        actions={
          <div className="flex items-center gap-3">
            <RiverLegend />
            <div
              role="group"
              aria-label="View"
              className="flex rounded-full border border-line p-0.5"
            >
              {(
                [
                  ['clock', 'Clock', Clock3],
                  ['river', 'River', Waves],
                  ['table', 'Table', Table2],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={view === k}
                  onClick={() => setView(k)}
                  className={
                    view === k
                      ? 'flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[0.75rem] font-medium text-canvas'
                      : 'flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-medium text-ink-2 hover:text-ink'
                  }
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="px-3 pb-3">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
        ) : q.isPending ? (
          <Skeleton className="h-[420px] w-full" />
        ) : table ? (
          <div
            className="max-h-[420px] overflow-auto px-2"
            tabIndex={0}
            role="region"
            aria-label="Weekly maturities table"
          >
            <table className="w-full text-[0.8125rem]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-[0.6875rem] tracking-[0.04em] text-ink-3 uppercase">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 text-right font-medium">Deposits</th>
                  {RIVER_BANDS.map((b) => (
                    <th key={b.key} className="py-2 text-right font-medium">
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {busy.map((w) => (
                  <tr key={w.week} className="border-b border-line last:border-0">
                    <td className="py-1.5 text-ink-2">
                      {new Date(w.week).toLocaleDateString('en-IN', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-1.5 text-right font-mono">{w.count}</td>
                    {RIVER_BANDS.map((b) => (
                      <td key={b.key} className="py-1.5 text-right font-mono">
                        {formatINRCompact(bandValue(w, b.levels))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : view === 'clock' ? (
          <MaturityClock
            months={months.slice(0, 24)}
            onMonthClick={(month) =>
              void navigate({
                to: '/instruments',
                search: {
                  maturity_from: month,
                  maturity_to: monthEnd(month),
                  ...(isToday ? {} : { asOf }),
                },
              })
            }
          />
        ) : (
          <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
            <MaturityRiver
              weeks={months}
              asOf={asOf}
              period="month"
              height={420}
              label="Value maturing each month by proof level"
              onWeekClick={(month) =>
                void navigate({
                  to: '/instruments',
                  search: {
                    maturity_from: month,
                    maturity_to: monthEnd(month),
                    ...(isToday ? {} : { asOf }),
                  },
                })
              }
            />
          </Suspense>
        )}
      </div>
    </Panel>
  )
}
