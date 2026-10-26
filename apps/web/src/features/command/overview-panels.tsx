import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'

import { IsoIndia } from '@/components/charts/iso-india'
import { AssuranceRing } from '@/components/signature/assurance'
import type { AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount } from '@/components/signature/chips'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'

import { useRegions } from './queries'

export function RegionPanel() {
  const { asOf, isToday } = useAsOf()
  const navigate = useNavigate()
  const q = useRegions(asOf)
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Where the money is"
        caption="AICTE regional offices as towers: height is value held, green is bank-confirmed"
      />
      <div className="px-5 pb-5">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
        ) : q.isPending ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <IsoIndia
            regions={q.data}
            onSelect={(code) =>
              void navigate({
                to: '/instruments',
                search: { region: [code], ...(isToday ? {} : { asOf }) },
              })
            }
          />
        )}
      </div>
    </Panel>
  )
}

export function ExposuresList() {
  const { asOf, isToday } = useAsOf()
  const q = useQuery({
    queryKey: ['portfolio', 'exposures', asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/exposures', {
          params: { query: { as_of: asOf, limit: 5 } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
  return (
    <div className="border-t border-line px-5 pt-4 pb-5">
      <p className="text-[0.75rem] font-medium text-ink-2">Largest unproven exposures</p>
      {q.isError ? (
        <ErrorState error={q.error} compact />
      ) : q.isPending ? (
        <Skeleton className="mt-2 h-28" />
      ) : q.data.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] text-ink-3">Every held deposit is bank-confirmed.</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {q.data.map((e) => (
            <li key={e.instrument_id}>
              <Link
                to="/instruments/$instrumentId"
                params={{ instrumentId: String(e.instrument_id) }}
                search={isToday ? {} : { asOf }}
                className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-sunken/60"
              >
                <AssuranceRing level={e.assurance as AssuranceLevel} size={16} showTip={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-ink">{e.institution}</span>
                  <span className="block truncate text-[0.6875rem] text-ink-3">{e.bank}</span>
                </span>
                <Amount paise={e.amount_paise} compact className="text-[0.8125rem]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
