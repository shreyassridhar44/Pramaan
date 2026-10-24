import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'

export function useSummary() {
  const { asOf } = useAsOf()
  return useQuery({
    queryKey: ['portfolio', 'summary', asOf],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/portfolio/summary', { params: { query: { as_of: asOf } } })),
    placeholderData: (prev) => prev,
  })
}
