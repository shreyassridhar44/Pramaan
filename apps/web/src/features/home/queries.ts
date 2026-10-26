import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'

export function usePublicSummary() {
  return useQuery({
    queryKey: ['public-summary'],
    queryFn: async () => unwrap(await api.GET('/api/v1/public/summary')),
    refetchInterval: 60_000,
  })
}
