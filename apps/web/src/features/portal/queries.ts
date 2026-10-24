import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'

export function usePortalHome() {
  return useQuery({
    queryKey: ['portal', 'home'],
    queryFn: async () => unwrap(await api.GET('/api/v1/portal/home')),
  })
}
