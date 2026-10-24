/** Names, colours and explanations of the assurance levels (PROJECT.md 3.3). */
export type AssuranceLevel = 0 | 1 | 2 | 3

export const ASSURANCE: Record<
  AssuranceLevel,
  { name: string; short: string; color: string; soft: string; text: string; explain: string }
> = {
  0: {
    name: 'Declared',
    short: 'A0',
    color: 'var(--a0)',
    soft: 'bg-a0-soft',
    text: 'text-a0',
    explain: 'Only the institution’s own entries. Nothing independent has been observed yet.',
  },
  1: {
    name: 'Document-checked',
    short: 'A1',
    color: 'var(--a1)',
    soft: 'bg-a1-soft',
    text: 'text-a1',
    explain: 'Values read from the uploaded receipt agree with the declaration.',
  },
  2: {
    name: 'Bank-confirmed',
    short: 'A2',
    color: 'var(--a2)',
    soft: 'bg-a2-soft',
    text: 'text-a2',
    explain: 'The issuing bank confirmed every material field in a signed message.',
  },
  3: {
    name: 'Re-confirmed',
    short: 'A3',
    color: 'var(--a3)',
    soft: 'bg-a3-soft',
    text: 'text-a3',
    explain: 'Bank-confirmed, and confirmed again within the last year.',
  },
}
