import { RIVER_BANDS } from './river-bands'

/** Proof-level key shared by the maturity clock and river. Kept apart from the river so the
 * clock can show it without loading ECharts. */
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
