import { useNavigate } from '@tanstack/react-router'
import { Table2, Waves } from 'lucide-react'
import { useState } from 'react'

import { MaturityRiver, RiverLegend } from '@/components/charts/maturity-river'
import { RIVER_BANDS, bandValue, byMonth } from '@/components/charts/river-bands'
import { Button } from '@/components/ui/button'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { useAsOf } from '@/lib/asof'
import { formatINRCompact } from '@/lib/format'

import { useRiver } from './queries'

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
  const [table, setTable] = useState(false)
  const months = byMonth(q.data ?? [])
  const busy = months.filter((m) => m.count > 0)
  return (
    <Panel className="h-full">
      <PanelHeader
        title="What matures when"
        caption="Value maturing each month over the next 24 months, by how well it is proven. Click a month to list its deposits."
        actions={
          <div className="flex items-center gap-3">
            <RiverLegend />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTable((t) => !t)}
              aria-pressed={table}
              aria-label={table ? 'Show chart' : 'Show as table'}
            >
              {table ? <Waves /> : <Table2 />} {table ? 'Chart' : 'Table'}
            </Button>
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
        ) : (
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
        )}
      </div>
    </Panel>
  )
}
