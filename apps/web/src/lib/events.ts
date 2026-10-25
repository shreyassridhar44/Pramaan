/** Plain-language names for event types and audit actions written by the API. */
const LABEL: Record<string, string> = {
  'instrument.submitted': 'Submitted by the institution',
  'instrument.document_checked': 'Receipt read and checked against the declaration',
  'instrument.verified': 'Verified by the Regulation Bureau',
  'instrument.verify': 'Verified by the Regulation Bureau',
  'officer.verify': 'Verified by the Regulation Bureau',
  'instrument.start_scrutiny': 'Scrutiny started',
  'officer.start_scrutiny': 'Scrutiny started',
  'instrument.return': 'Returned to the institution',
  'officer.return': 'Returned to the institution',
  'instrument.assign': 'Assigned to an officer',
  'officer.assign': 'Assigned to an officer',
  'instrument.observe': 'Observation recorded',
  'officer.observe': 'Observation recorded',
  'instrument.correction': 'Declared value corrected by an officer',
  'officer.correction': 'Declared value corrected by an officer',
  'instrument.resubmitted': 'Corrected and resubmitted by the institution',
  'instrument.discrepancy': 'Discrepancy raised',
  'instrument.renewed': 'Renewed',
  'instrument.released': 'Released, lien discharged by the bank',
  'instrument.encashed_prematurely': 'Encashed before maturity',
  'instrument.lien_hold': 'Lien hold placed',
  'bank.confirm_requested': 'Confirmation requested from the bank',
  'bank.reconfirm_requested': 'Re-confirmation requested from the bank',
  'bank.discharge_requested': 'Lien discharge requested from the bank',
  'bank.response_received': 'Signed response received from the bank',
  'bank.confirmed': 'Confirmed by the issuing bank',
  'bank.reconfirmed': 'Re-confirmed by the issuing bank',
  'bank.discharged': 'Lien discharged by the bank',
  'signal.confirmed': 'Signal confirmed as an issue',
  'signal.dismissed': 'Signal dismissed with a reason',
  'signal.resolved': 'Signal resolved',
  'document.uploaded': 'Document uploaded',
  'document.viewed': 'Document viewed',
  'release.requested': 'Release applied for',
  'release.applied': 'Application received',
  'release.cleared': 'Cleared for release by the competent authority',
  'release.authorised': 'Release authorised and letter issued',
  'release.discharged': 'Lien discharged by the bank',
  'clearance.cleared': 'Clearance given',
  'clearance.blocked': 'Clearance blocked',
  'complaint.resolved': 'Complaint resolved',
  'letter.issued': 'Letter issued',
  'letter.revoked': 'Letter revoked',
  'monitoring.run': 'Daily monitoring run',
  'audit.chain_verified': 'Audit chain verified',
  'auth.sign_in': 'Signed in',
  'auth.sign_in_persona': 'Signed in with a demo persona',
}

export function eventLabel(type: string): string {
  const known = LABEL[type]
  if (known) return known
  const words = type.replace(/[._]/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const FIELD: Record<string, string> = {
  amount: 'Amount',
  issue_date: 'Issue date',
  maturity_date: 'Maturity date',
  ifsc: 'IFSC',
  holders: 'Holders',
  lien: 'Lien',
}

/** The human detail of an event, such as the reason for a return or what a correction changed. */
export function eventDetail(type: string, payload: Record<string, unknown> | undefined) {
  if (!payload) return null
  const reason = typeof payload.reason === 'string' ? payload.reason : null
  const note = typeof payload.note === 'string' ? payload.note : null
  if (type === 'officer.correction') {
    const field = FIELD[String(payload.field)] ?? String(payload.field)
    return `${field} changed from ${payload.from ?? 'blank'} to ${payload.to}. ${reason ?? ''}`.trim()
  }
  if (type === 'instrument.resubmitted' && Array.isArray(payload.changed)) {
    const changed = payload.changed.map((c) => FIELD[String(c)] ?? String(c)).join(', ')
    return `Changed: ${changed}. ${note ?? ''}`.trim()
  }
  return reason ?? note
}
