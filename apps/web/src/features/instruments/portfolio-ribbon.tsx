import { motion, useReducedMotion } from 'motion/react'

import { GuillocheBand } from '@/components/security/guilloche'
import { SplitFlap } from '@/components/security/split-flap'
import { STATUS, type Tone } from '@/components/signature/status-meta'
import { useSummary } from '@/features/command/queries'
import { cn } from '@/lib/cn'
import { formatCount, formatINRCompact } from '@/lib/format'

const TONE_FILL: Record<Tone, string> = {
  neutral: 'var(--chart-a0)',
  info: 'var(--chart-a1)',
  ok: 'var(--board-a2)',
  due: 'var(--board-due)',
  overdue: 'var(--board-overdue)',
  simulated: 'var(--simulated)',
  brand: 'var(--saffron)',
}

/**
 * Every held deposit at a glance, above the registry: one segment per status, sized by count.
 * Clicking a segment filters the table to that status.
 */
export function PortfolioRibbon({
  active,
  onPick,
}: {
  active?: string[]
  onPick: (status: string | null) => void
}) {
  const reduce = useReducedMotion()
  const s = useSummary().data
  if (!s) return <div className="h-[118px] animate-pulse rounded-[16px] bg-board/90" />
  const entries = Object.entries(s.by_status_count).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((a, [, n]) => a + n, 0) || 1
  return (
    <section className="relative overflow-hidden rounded-[16px] bg-board text-board-ink">
      <GuillocheBand height={8} color="rgb(255 153 51 / 0.4)" />
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-3">
        <div>
          <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-board-ink/65 uppercase">
            Held instruments
          </p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="text-[1.5rem]">
              <SplitFlap value={formatCount(s.held_count)} />
            </span>
            <span className="font-mono text-[0.875rem] text-board-ink/75">
              {formatINRCompact(s.held_paise)}
            </span>
          </p>
        </div>
        {active?.length ? (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="rounded-full bg-white/10 px-3 py-1 text-[0.75rem] hover:bg-white/20"
          >
            Show every status
          </button>
        ) : (
          <p className="text-[0.75rem] text-board-ink/65">Click a segment to filter the registry</p>
        )}
      </div>
      <div className="flex h-9 gap-[2px] px-5 pt-3" role="group" aria-label="Filter by status">
        {entries.map(([key, n], i) => {
          const meta = STATUS[key]
          const on = active?.includes(key)
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => onPick(on ? null : key)}
              aria-pressed={on}
              aria-label={`${meta?.label ?? key}: ${n}`}
              title={`${meta?.label ?? key}: ${formatCount(n)}`}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: reduce ? 0 : i * 0.04, duration: 0.4 }}
              style={{
                flexGrow: n,
                flexBasis: 0,
                background: TONE_FILL[meta?.tone ?? 'neutral'],
                transformOrigin: 'left',
              }}
              className={cn(
                'min-w-[6px] rounded-[4px] transition-[opacity,box-shadow]',
                active?.length && !on ? 'opacity-35' : 'opacity-100',
                on && 'shadow-[0_0_0_2px_var(--board-ink)]',
              )}
            />
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2 pb-3">
        {entries.map(([key, n]) => (
          <li key={key} className="flex items-center gap-1.5 text-[0.6875rem] text-board-ink/75">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: TONE_FILL[STATUS[key]?.tone ?? 'neutral'] }}
              aria-hidden
            />
            {STATUS[key]?.label ?? key}
            <span className="font-mono text-board-ink">{formatCount(n)}</span>
            <span className="text-board-ink/50">{Math.round((n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
