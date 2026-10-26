import { animate, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** A number that rolls to its new value when the as-of date changes. */
export function RollingNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.6, ease: [0.2, 0, 0, 1] })
    return () => controls.stop()
  }, [value, mv, reduce])
  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>
}

export function HeadlineFigure({
  label,
  figure,
  caption,
  aside,
  tone,
  delta,
}: {
  label: string
  figure: ReactNode
  caption?: ReactNode
  aside?: ReactNode
  delta?: string | null
  tone?: 'default' | 'a2' | 'due' | 'overdue'
}) {
  return (
    <div className="relative flex min-w-0 items-start justify-between gap-4 px-6 py-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[0.6875rem] font-medium tracking-[0.1em] text-board-ink/60 uppercase">
          <span
            aria-hidden
            className={cn(
              'size-1.5 rotate-45',
              tone === 'a2'
                ? 'bg-board-a2'
                : tone === 'due'
                  ? 'bg-board-due'
                  : tone === 'overdue'
                    ? 'bg-board-overdue'
                    : 'bg-saffron',
            )}
          />
          {label}
        </p>
        <p
          className={cn(
            'mt-2 font-display text-[3.4rem] leading-[0.95] tracking-[-0.01em]',
            tone === 'a2'
              ? 'text-board-a2'
              : tone === 'due'
                ? 'text-board-due'
                : tone === 'overdue'
                  ? 'text-board-overdue'
                  : 'text-board-ink',
          )}
        >
          {figure}
        </p>
        {caption ? <p className="mt-2 text-[0.8125rem] text-board-ink/65">{caption}</p> : null}
        {delta ? (
          <p className="mt-1 font-mono text-[0.6875rem] text-board-ink/65">{delta}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0 pt-1">{aside}</div> : null}
    </div>
  )
}
