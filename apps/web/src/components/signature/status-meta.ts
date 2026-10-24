export type Tone = 'neutral' | 'info' | 'ok' | 'due' | 'overdue' | 'simulated' | 'brand'

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  submitted: { label: 'Submitted', tone: 'info' },
  under_scrutiny: { label: 'Under scrutiny', tone: 'info' },
  returned: { label: 'Returned', tone: 'due' },
  discrepancy: { label: 'Discrepancy', tone: 'overdue' },
  active: { label: 'Active', tone: 'neutral' },
  maturing: { label: 'Maturing', tone: 'due' },
  matured: { label: 'Matured, no action', tone: 'overdue' },
  renewal_pending: { label: 'Renewal pending', tone: 'due' },
  renewed: { label: 'Renewed', tone: 'ok' },
  release_requested: { label: 'Release requested', tone: 'info' },
  release_cleared: { label: 'Cleared for release', tone: 'ok' },
  released: { label: 'Released', tone: 'ok' },
  lien_hold: { label: 'Lien hold', tone: 'overdue' },
  forfeited: { label: 'Forfeited', tone: 'overdue' },
  encashed_prematurely: { label: 'Encashed early', tone: 'overdue' },
}

export function statusLabel(status: string) {
  return STATUS[status]?.label ?? status
}
