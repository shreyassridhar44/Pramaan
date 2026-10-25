import { LineChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'

import type { components } from '@/lib/api/schema'
import { formatDate, formatINRCompact } from '@/lib/format'

import { RIVER_BANDS, bandValue } from './river-bands'
import { useChartColors } from './use-chart-colors'

echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer])

type Week = components['schemas']['RiverWeek']

/**
 * Value maturing each week, stacked by how well it is proven (PROTOTYPE.md 3.3). Bank-confirmed
 * combines A2 and A3 so the bands stay distinguishable. Hover shows the week; click lists it.
 */
export function MaturityRiver({
  weeks,
  asOf,
  playhead,
  onWeekClick,
  height = 280,
  label = 'Value maturing each week by proof level',
  period = 'week',
}: {
  weeks: Week[]
  asOf: string
  playhead?: string
  onWeekClick?: (week: string) => void
  height?: number
  label?: string
  /** Whether each point is a week or a calendar month, for the hover readout. */
  period?: 'week' | 'month'
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const colors = useChartColors()
  const reduce = useReducedMotion()
  const clickRef = useRef(onWeekClick)
  const weeksRef = useRef(weeks)
  useEffect(() => {
    clickRef.current = onWeekClick
    weeksRef.current = weeks
  })

  useEffect(() => {
    if (!el.current) return
    const c = echarts.init(el.current, null, { renderer: 'svg' })
    chart.current = c
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current)
    c.getZr().on('click', (e) => {
      const point = c.convertFromPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY])
      if (!point || point[0] == null) return
      const t = Number(point[0])
      // Snap to the plotted week nearest the click.
      let best: string | null = null
      let gap = Infinity
      for (const w of weeksRef.current) {
        const d = Math.abs(new Date(w.week).getTime() - t)
        if (d < gap) [best, gap] = [w.week, d]
      }
      if (best) clickRef.current?.(best)
    })
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])

  const option = useMemo(() => {
    const band = (i: 0 | 1 | 2) => RIVER_BANDS[i]
    const series = ([0, 1, 2] as const).map((i) => ({
      name: band(i).label,
      type: 'line' as const,
      stack: 'value',
      smooth: 0.25,
      symbol: 'none',
      // The 2px line in the surface colour is the gap between bands.
      lineStyle: { width: 2, color: colors.surface },
      areaStyle: { color: colors[`chart-a${i}`], opacity: 0.9 },
      emphasis: { disabled: true },
      data: weeks.map((w) => [w.week, bandValue(w, band(i).levels) / 1e9]),
      markLine:
        i === 2
          ? {
              symbol: 'none',
              silent: true,
              animation: false,
              data: [
                {
                  xAxis: asOf,
                  lineStyle: { color: colors['ink-2'], width: 1, type: 'solid' as const },
                  label: {
                    show: false,
                  },
                },
                ...(playhead
                  ? [
                      {
                        xAxis: playhead,
                        lineStyle: { color: colors.accent, width: 2, type: 'solid' as const },
                        label: { show: false },
                      },
                    ]
                  : []),
              ],
            }
          : undefined,
    }))
    return {
      animationDuration: reduce ? 0 : 400,
      animationDurationUpdate: reduce ? 0 : 250,
      grid: { left: 56, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: 'time' as const,
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false },
        axisLabel: {
          color: colors['ink-3'],
          fontSize: 11,
          formatter: (v: number) =>
            new Date(v).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: colors['ink-3'], fontSize: 11, formatter: (v: number) => `₹${v} Cr` },
        splitLine: { lineStyle: { color: colors.line, width: 1 } },
      },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'line' as const, lineStyle: { color: colors['line-strong'] } },
        backgroundColor: colors.surface,
        borderColor: colors.line,
        textStyle: { color: colors.ink, fontSize: 12 },
        formatter: (params: { axisValue: number; dataIndex: number }[]) => {
          const w = weeks[params[0]?.dataIndex ?? 0]
          if (!w) return ''
          const rows = RIVER_BANDS.map(
            (b, i) =>
              `<div style="display:flex;justify-content:space-between;gap:16px">` +
              `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;` +
              `background:${colors[`chart-a${i}` as 'chart-a0']};margin-right:6px"></span>${b.label}</span>` +
              `<span style="font-family:var(--font-mono)">${formatINRCompact(bandValue(w, b.levels))}</span></div>`,
          ).join('')
          const total = RIVER_BANDS.reduce((s, b) => s + bandValue(w, b.levels), 0)
          return (
            `<div style="min-width:220px"><div style="font-weight:600;margin-bottom:6px">` +
            `${period === 'month' ? new Date(w.week).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : `Week of ${formatDate(w.week)}`}</div>${rows}` +
            `<div style="border-top:1px solid ${colors.line};margin-top:6px;padding-top:6px;` +
            `display:flex;justify-content:space-between"><span>${w.count} deposits</span>` +
            `<span style="font-family:var(--font-mono)">${formatINRCompact(total)}</span></div>` +
            (onWeekClick
              ? `<div style="color:${colors['ink-3']};font-size:11px;margin-top:4px">Click to list them</div>`
              : '') +
            `</div>`
          )
        },
      },
      series,
    }
  }, [weeks, asOf, playhead, colors, reduce, onWeekClick, period])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: false, lazyUpdate: true })
  }, [option])

  return (
    <div
      ref={el}
      role="img"
      aria-label={label}
      style={{ height, cursor: onWeekClick ? 'pointer' : undefined }}
      className="w-full"
    />
  )
}

export function RiverLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-ink-2">
      {RIVER_BANDS.map((b, i) => (
        <li key={b.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: `var(--chart-a${i})` }}
          />
          {b.label}
        </li>
      ))}
    </ul>
  )
}
