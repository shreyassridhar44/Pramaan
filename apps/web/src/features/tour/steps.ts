/**
 * The guided tour: the six test scenarios of the problem statement (R16) and the evidence the
 * evaluators look for (R15), told across the people who use Pramaan. Each step names the persona
 * it needs, the screen, and the element to spotlight (a data-tour attribute).
 */
export type TourStep = {
  persona?: string
  path: string
  target?: string
  kicker: string
  title: string
  body: string
}

export const STEPS: TourStep[] = [
  {
    path: '/home',
    target: 'specimen',
    kicker: 'The idea',
    title: 'Proof you can see',
    body: 'Every deposit earns visible security features as it is proven: a watermark once its scan is read, a seal when the bank confirms, foil when it is confirmed again.',
  },
  {
    persona: 'bureau',
    path: '/',
    target: 'board',
    kicker: 'Dashboard (R9, R15)',
    title: 'How much we hold, how much is proven, what needs action',
    body: 'The Regulation Bureau sees the whole portfolio in one board, computed live from the rules. Every figure opens the records behind it.',
  },
  {
    persona: 'bureau',
    path: '/',
    target: 'river',
    kicker: 'Validity tracking (R5)',
    title: 'What matures when, by how well it is proven',
    body: 'Two years of maturities, layered by assurance. Click any month to see exactly which deposits fall due.',
  },
  {
    persona: 'bureau',
    path: '/forecast',
    target: 'forecast',
    kicker: 'Approaching maturity (R6, R12)',
    title: 'The time machine',
    body: 'Run the configured rules forward: watch reminders go out at T-90, T-60 and T-30, and escalations climb when nobody acts. Nothing is saved.',
  },
  {
    persona: 'institution',
    path: '/portal/submit',
    target: 'main',
    kicker: 'New FDR submission (R2)',
    title: 'Institutions file online, in Hindi and English',
    body: 'The institution enters the deposit and uploads the scan. Pramaan reads it on the spot and shows what it found, so typing mistakes are fixed before submission.',
  },
  {
    persona: 'bureau',
    path: '/queue',
    target: 'queue',
    kicker: 'Discrepancy identification (R3)',
    title: 'The officer’s queue, signals first',
    body: 'Submissions with a possible alteration or a mismatch come first. A trained model marks the exact characters that look edited; the officer decides.',
  },
  {
    persona: 'bank',
    path: '/bank',
    target: 'main',
    kicker: 'Bank confirmation (R4, R14)',
    title: 'The bank answers in a signed message',
    body: 'The issuing bank confirms from its own record, signed with Ed25519. Declared, read and confirmed values are stored apart and never mixed. The bank here is simulated.',
  },
  {
    persona: 'bureau',
    path: '/releases',
    target: 'main',
    kicker: 'Authorised release (R8)',
    title: 'Release is never automatic',
    body: 'A release case collects clearances from PGRC, Vigilance and Grants, checks every condition with its handbook clause, and waits for the competent authority.',
  },
  {
    persona: 'pgrc',
    path: '/clearances',
    target: 'main',
    kicker: 'Clearance cells',
    title: 'Each cell clears or blocks, with a reason',
    body: 'An open grievance blocks the release until it is resolved. Every decision carries the officer, the time and the reason.',
  },
  {
    persona: 'auditor',
    path: '/audit',
    target: 'chain',
    kicker: 'Audit trail (R13)',
    title: 'Tamper-evident, and you can test it',
    body: 'Every action is chained by SHA-256. Try the tamper drill: edit one entry behind Pramaan’s back and the chain check finds the exact entry.',
  },
  {
    path: '/home',
    target: 'verify',
    kicker: 'Letters anyone can check',
    title: 'Scan the QR on any NOC',
    body: 'Banks, institutions and the public can verify a letter without signing in. A revoked or replaced letter shows as such even if the paper looks perfect.',
  },
]
