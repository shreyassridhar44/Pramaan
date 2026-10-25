import { useMemo } from 'react'

import { useTheme } from '@/lib/theme'

const NAMES = [
  'chart-a0',
  'chart-a1',
  'chart-a2',
  'surface',
  'line',
  'line-strong',
  'ink',
  'ink-2',
  'ink-3',
  'accent',
  'overdue',
  'due',
  'a2',
  'brand',
] as const

export type ChartColors = Record<(typeof NAMES)[number], string>

/** Design tokens resolved for canvas or SVG charts, re-read when the theme changes. */
export function useChartColors(): ChartColors {
  const { theme } = useTheme()
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      NAMES.map((n) => [n, css.getPropertyValue(`--${n}`).trim() || '#888']),
    ) as ChartColors
    // The theme is the dependency: tokens change when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])
}
