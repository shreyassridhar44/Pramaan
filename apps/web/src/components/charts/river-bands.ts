import type { components } from '@/lib/api/schema'

type Week = components['schemas']['RiverWeek']

/** Bank-confirmed combines A2 and A3 so the stacked bands stay distinguishable. */
export const RIVER_BANDS = [
  { key: 'a0', label: 'Declared', levels: ['0'] },
  { key: 'a1', label: 'Document-checked', levels: ['1'] },
  { key: 'a2', label: 'Bank-confirmed', levels: ['2', '3'] },
] as const

export function bandValue(w: Week, levels: readonly string[]) {
  return levels.reduce((sum, l) => sum + Number(w.by_assurance_paise[l] ?? 0), 0)
}

/** Weekly points rolled up by calendar month (the period starts on the 1st). */
export function byMonth(weeks: Week[]): Week[] {
  const out = new Map<string, Week>()
  for (const w of weeks) {
    const key = `${w.week.slice(0, 7)}-01`
    const m = out.get(key) ?? { week: key, count: 0, by_assurance_paise: {} }
    m.count += w.count
    for (const [level, v] of Object.entries(w.by_assurance_paise)) {
      m.by_assurance_paise[level] = String(
        BigInt(m.by_assurance_paise[level] ?? '0') + BigInt(v ?? '0'),
      )
    }
    out.set(key, m)
  }
  return [...out.values()]
}
