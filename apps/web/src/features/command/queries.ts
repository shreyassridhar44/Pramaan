import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'

/** Portfolio summary for the global as-of date, or for `date` when given. */
export function useSummary(date?: string) {
  const { asOf } = useAsOf()
  const d = date ?? asOf
  return useQuery({
    queryKey: ['portfolio', 'summary', d],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/summary', { params: { query: { as_of: d } } })),
    placeholderData: (prev) => prev,
  })
}

export function useRiver(asOf: string, months = 24) {
  return useQuery({
    queryKey: ['portfolio', 'river', asOf, months],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/portfolio/river', { params: { query: { as_of: asOf, months } } }),
      ),
    placeholderData: (prev) => prev,
  })
}

export function useRegions(asOf: string) {
  return useQuery({
    queryKey: ['portfolio', 'regions', asOf],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/regions', { params: { query: { as_of: asOf } } })),
    placeholderData: (prev) => prev,
  })
}
