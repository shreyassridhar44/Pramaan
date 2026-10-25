import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ApiError, api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type ReleaseRow = components['schemas']['ReleaseRow']
export type ReleaseDetail = components['schemas']['ReleaseDetail']

export function useReleases(state: 'open' | 'closed' | 'all') {
  return useQuery({
    queryKey: ['releases', state],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/releases', { params: { query: { state } } })),
  })
}

export function useRelease(id: number, portal = false) {
  return useQuery({
    queryKey: ['release', id],
    queryFn: async () =>
      unwrap(
        portal
          ? await api.GET('/api/v1/portal/releases/{case_id}', {
              params: { path: { case_id: id } },
            })
          : await api.GET('/api/v1/releases/{case_id}', { params: { path: { case_id: id } } }),
      ),
  })
}

/** Shared success and error handling for every action on a case. */
export function useCaseMutation<T>(id: number, fn: (vars: T) => Promise<unknown>, done: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(done)
      void qc.invalidateQueries({ queryKey: ['release', id] })
      void qc.invalidateQueries({ queryKey: ['releases'] })
      void qc.invalidateQueries({ queryKey: ['clearances'] })
      void qc.invalidateQueries({ queryKey: ['letters'] })
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
}
