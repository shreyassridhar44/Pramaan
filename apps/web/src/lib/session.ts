import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Me = components['schemas']['Me']

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    const res = await api.GET('/api/v1/auth/me')
    if (res.response.status === 401) return null
    return unwrap(res)
  },
  staleTime: 5 * 60_000,
})

export function useMe() {
  return useQuery(meQuery)
}

export const OFFICER_ROLES = new Set([
  'bureau_officer',
  'section_head',
  'regional_officer',
  'approving_authority',
  'auditor',
  'admin',
])

/** Where each role lands after signing in. */
export function homeFor(role: string): string {
  if (role === 'institution_user') return '/portal'
  if (role === 'bank_officer') return '/bank'
  if (role === 'cell_officer') return '/clearances'
  return '/'
}

export const ROLE_LABEL: Record<string, string> = {
  bureau_officer: 'Regulation Bureau',
  section_head: 'Regulation Bureau, Section head',
  regional_officer: 'Regional Office',
  approving_authority: 'Approval Bureau, Competent authority',
  cell_officer: 'Clearance cell',
  institution_user: 'Institution',
  bank_officer: 'Bank desk',
  auditor: 'Audit',
  admin: 'Administration',
}

export function useSignOut() {
  const qc = useQueryClient()
  return async () => {
    await api.POST('/api/v1/auth/logout')
    qc.clear()
    window.location.assign('/signin')
  }
}
