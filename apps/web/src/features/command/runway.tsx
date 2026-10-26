import { useNavigate } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'

import { addDays, useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINRCompact } from '@/lib/format'

import { useRiver, useSummary } from './queries'

const WEEKS = 13
const BAR = 92

const LEVELS = [
  { key: '0', label: 'Declared', color: 'var(--chart-a0)' },
  { key: '1', label: 'Document-checked', color: 'var(--chart-a1)' },
  { key: '2', label: 'Bank-confirmed', color: 'var(--chart-a2)' },
] as const

type Week = { week: string; count: number; total: number; parts: number[] }

/**
 * The maturity runway under the headline board: the money that falls due in each of the next 13
 * weeks and still has no release application, split by how well it is proven, with the backlog
 * that has already matured without action on the left. A week or the backlog opens the registry.
 */
export function MaturityRunway() {
  const { asOf, isToday } = useAsOf()
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const summary = useSummary().data
  const river = useRiver(asOf, 3)

  const weeks: Week[] = (river.data ?? []).slice(0, WEEKS).map((w) => {
    // Level 3 (re-confirmed) is still bank-confirmed money; it joins level 2 here.
    const v = (k: string) => Number(w.by_assurance_paise[k] ?? 0)
    const parts = [v('0'), v('1'), v('2') + v('3')]
    return { week: w.week, count: w.count, total: parts[0]! + parts[1]! + parts[2]!, parts }
  })
  const max = Math.max(1, ...weeks.map((w) => w.total))
  const total = weeks.reduce((a, w) => a + w.total, 0)
  const count = weeks.reduce((a, w) => a + w.count, 0)
  const unproven = weeks.reduce((a, w) => a + w.parts[0]! + w.parts[1]!, 0)
  const keep = isToday ? {} : { asOf }

  return (
    <div className="relative border-t border-board-ink/10 px-6 pt-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-board-ink/70 uppercase">
            Maturity runway, next 13 weeks
          </p>
          <p className="mt-1 text-[0.8125rem] text-board-ink/80">
            {river.data ? (
              <>
                <span className="font-semibold text-board-ink">{formatINRCompact(total)}</span> in{' '}
                {formatCount(count)} deposits falls due without a release application;{' '}
                <span className="font-semibold text-board-due">{formatINRCompact(unproven)}</span>{' '}
                of it is not yet confirmed by a bank.
              </>
            ) : (
              'Loading the next 13 weeks.'
            )}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEVELS.map((l) => (
            <li
              key={l.key}
              className="flex items-center gap-1.5 text-[0.6875rem] text-board-ink/75"
            >
              <span
                className="size-2.5 rounded-[2px]"
                style={{ background: l.color }}
                aria-hidden
              />
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      {river.isError ? (
        <p className="py-10 text-center text-[0.8125rem] text-board-ink/70">
          The runway could not be loaded.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-[minmax(92px,1.3fr)_repeat(13,minmax(0,1fr))] items-end gap-1.5">
          <button
            type="button"
            onClick={() =>
              void navigate({ to: '/instruments', search: { status: ['matured'], ...keep } })
            }
            aria-label={`Already matured without action: ${summary?.overdue_count ?? 0} deposits. Open them in the registry.`}
            className="group flex h-full flex-col justify-end rounded-[10px] border border-board-overdue/40 bg-board-overdue/[0.08] px-3 py-2.5 text-left transition-colors hover:bg-board-overdue/[0.14]"
          >
            <span className="font-display text-[2rem] leading-none text-board-overdue">
              {summary ? formatCount(summary.overdue_count) : '-'}
            </span>
            <span className="mt-1.5 text-[0.6875rem] leading-tight font-medium text-board-ink/80">
              Already matured, no action
            </span>
          </button>
          {(weeks.length ? weeks : Array.from({ length: WEEKS }, () => null)).map((w, i) => {
            if (!w)
              return (
                <div key={i} className="flex h-[150px] flex-col justify-end" aria-hidden>
                  <div className="h-10 animate-pulse rounded-[4px] bg-board-ink/[0.06]" />
                </div>
              )
            const thisWeek = i === 0
            const end = addDays(w.week, 6)
            const h = w.total ? Math.max(6, (w.total / max) * BAR) : 0
            return (
              <button
                key={w.week}
                type="button"
                disabled={!w.count}
                onClick={() =>
                  void navigate({
                    to: '/instruments',
                    search: { maturity_from: w.week, maturity_to: end, ...keep },
                  })
                }
                aria-label={`Week of ${formatDate(w.week)}: ${formatINRCompact(w.total)} in ${w.count} deposits, ${w.total ? Math.round((w.parts[2]! / w.total) * 100) : 0}% bank-confirmed`}
                className={cn(
                  'group relative flex flex-col items-stretch rounded-[8px] px-1 pt-1 pb-1.5 text-center transition-colors',
                  w.count ? 'hover:bg-board-ink/[0.06]' : 'cursor-default',
                  thisWeek && 'bg-board-ink/[0.05]',
                )}
              >
                <span
                  className={cn(
                    'font-mono text-[0.6875rem] leading-none whitespace-nowrap',
                    w.count ? 'text-board-ink' : 'text-board-ink/40',
                  )}
                >
                  {w.count ? formatINRCompact(w.total) : '-'}
                </span>
                <span className="mt-1.5 flex h-[92px] flex-col justify-end">
                  <motion.span
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: h }}
                    transition={{
                      delay: reduce ? 0 : i * 0.03,
                      duration: 0.5,
                      ease: [0.2, 0, 0, 1],
                    }}
                    className="flex flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                  >
                    {w.parts.map((p, k) =>
                      p ? (
                        <span
                          key={k}
                          style={{ flexGrow: p, flexBasis: 0, background: LEVELS[k]!.color }}
                          className="min-h-[2px]"
                        />
                      ) : null,
                    )}
                  </motion.span>
                  <span className="h-px bg-board-ink/25" aria-hidden />
                </span>
                <span
                  className={cn(
                    'mt-1.5 text-[0.6875rem] leading-none whitespace-nowrap',
                    thisWeek ? 'font-semibold text-board-accent' : 'text-board-ink/75',
                  )}
                >
                  {thisWeek ? 'This week' : shortDate(w.week)}
                </span>
                <span className="mt-1 text-[0.625rem] leading-none text-board-ink/70">
                  {w.count ? `${w.count} FDR${w.count === 1 ? '' : 's'}` : 'none'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
