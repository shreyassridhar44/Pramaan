import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'
import { useAsOf } from '@/lib/asof'

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: async () => unwrap(await api.GET('/api/v1/meta')),
    staleTime: Infinity,
  })
}

export function useInstrument(id: number) {
  const { asOf } = useAsOf()
  return useQuery({
    queryKey: ['instrument', id, asOf],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/instruments/{instrument_id}', {
          params: { path: { instrument_id: id }, query: { as_of: asOf } },
        }),
      ),
    placeholderData: (prev) => prev,
  })
}
