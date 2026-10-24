import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'

/** Today's date in IST as YYYY-MM-DD. */
export function todayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

/**
 * The global "as of" date. It lives in the URL (`?asOf=YYYY-MM-DD`) so every screen and every
 * shared link agrees. Absent means today. Forecast dates are read-only views computed by the
 * server's as-of engine.
 */
export function useAsOf() {
  const search = useSearch({ strict: false }) as { asOf?: string }
  const navigate = useNavigate()
  const today = todayIso()
  const asOf = search.asOf && /^\d{4}-\d{2}-\d{2}$/.test(search.asOf) ? search.asOf : today
  const isToday = asOf === today
  const setAsOf = useCallback(
    (next: string | null) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          asOf: next && next !== todayIso() ? next : undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )
  return { asOf, isToday, today, setAsOf, offsetDays: daysBetween(today, asOf) }
}
