import type { Tone } from '@/components/signature/status-meta'

export const CASE_STATUS: Record<string, { label: string; tone: Tone }> = {
  applied: { label: 'Applied', tone: 'info' },
  in_clearance: { label: 'Collecting clearances', tone: 'info' },
  blocked: { label: 'Blocked', tone: 'overdue' },
  cleared: { label: 'Ready for authorisation', tone: 'ok' },
  authorised: { label: 'Authorised, awaiting bank', tone: 'brand' },
  discharged: { label: 'Discharged', tone: 'ok' },
  closed: { label: 'Released', tone: 'ok' },
}

export const CELLS = [
  { key: 'pgrc', short: 'PGRC', label: 'PGRC' },
  { key: 'vigilance', short: 'Vig', label: 'Vigilance Cell' },
  { key: 'grants', short: 'Grants', label: 'Grants bureaus' },
] as const

export const CELL_NAME: Record<string, string> = {
  pgrc: 'Public Grievance Redressal Cell',
  vigilance: 'Vigilance Cell',
  grants: 'Grants bureaus',
}

export const KIND_LABEL: Record<string, string> = {
  joint_fdr: 'Joint FDR',
  rpgf: 'RPGF',
  rtgs: 'RTGS',
}

export const EVENT_LABEL: Record<string, string> = {
  'release.applied': 'Application received',
  'clearance.cleared': 'Clearance given',
  'clearance.blocked': 'Clearance blocked',
  'release.authorised': 'Release authorised and letter issued',
  'release.discharged': 'Lien discharged by the bank',
}
