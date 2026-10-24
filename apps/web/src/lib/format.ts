/**
 * Indian number and date formatting used everywhere in the UI.
 * Amounts arrive from the API as integer paise (string or number) and are shown in rupees.
 */

const PAISE_PER_RUPEE = 100n
const LAKH = 1_00_000n
const CRORE = 1_00_00_000n

function toPaise(value: bigint | number | string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(Math.round(value))
  return BigInt(value)
}

/** Groups digits in the Indian system: 15,00,000 and 4,12,50,000. */
export function groupIndian(rupees: bigint): string {
  const negative = rupees < 0n
  const digits = (negative ? -rupees : rupees).toString()
  if (digits.length <= 3) return (negative ? '-' : '') + digits
  const lastThree = digits.slice(-3)
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${rest},${lastThree}`
}

/** Full amount, for example ₹15,00,000. Paise are shown only when non-zero. */
export function formatINR(paise: bigint | number | string): string {
  const p = toPaise(paise)
  const rupees = p / PAISE_PER_RUPEE
  const rem = (p < 0n ? -p : p) % PAISE_PER_RUPEE
  const base = `₹${groupIndian(rupees)}`
  return rem === 0n ? base : `${base}.${rem.toString().padStart(2, '0')}`
}

/** Compact amount, for example ₹15 L or ₹412.6 Cr. */
export function formatINRCompact(paise: bigint | number | string): string {
  const rupees = toPaise(paise) / PAISE_PER_RUPEE
  const abs = rupees < 0n ? -rupees : rupees
  const sign = rupees < 0n ? '-' : ''
  if (abs >= CRORE) return `${sign}₹${trimDecimal(Number(abs) / Number(CRORE))} Cr`
  if (abs >= LAKH) return `${sign}₹${trimDecimal(Number(abs) / Number(LAKH))} L`
  return `${sign}₹${groupIndian(abs)}`
}

function trimDecimal(n: number): string {
  const fixed = n >= 100 ? n.toFixed(1) : n.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

/** Absolute date, for example 12 Mar 2027. Accepts ISO dates (YYYY-MM-DD) or timestamps. */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? parseIsoDate(value) : value
  return DATE_FMT.format(d)
}

function parseIsoDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value)
}

const DAY_MS = 86_400_000

/** Relative hint shown next to an absolute date: "in 23 days", "5 days ago", "today". */
export function formatRelativeDays(target: string | Date, asOf: string | Date): string {
  const t = typeof target === 'string' ? parseIsoDate(target) : target
  const a = typeof asOf === 'string' ? parseIsoDate(asOf) : asOf
  const days = Math.round((t.getTime() - a.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/** Plain count with Indian grouping, for example 1,20,345. */
export function formatCount(n: number): string {
  return groupIndian(BigInt(Math.round(n)))
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`
}
