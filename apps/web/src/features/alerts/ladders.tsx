import { motion, useReducedMotion } from 'motion/react'

import { GuillocheBand } from '@/components/security/guilloche'
import { cn } from '@/lib/cn'
import { formatCount } from '@/lib/format'

type Step = { key: string; label: string; sub: string; count: number; tone: string }

/**
 * A ladder drawn as stairs: each step a stage, its height growing towards the critical end, with
 * the count on the tread. Used for the reminder ladder (T-90 to maturity) and the escalation ladder.
 */
export function Stairs({
  title,
  caption,
  steps,
}: {
  title: string
  caption: string
  steps: Step[]
}) {
  const reduce = useReducedMotion()
  const max = Math.max(1, ...steps.map((s) => s.count))
  return (
    <section className="relative overflow-hidden rounded-[16px] bg-board text-board-ink">
      <GuillocheBand height={8} color="rgb(255 153 51 / 0.4)" />
      <div className="px-5 pt-3 pb-5">
        <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-board-ink/65 uppercase">
          {title}
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-board-ink/75">{caption}</p>
        <ol className="mt-4 flex items-end gap-2">
          {steps.map((s, i) => {
            const rise = 28 + (i / Math.max(1, steps.length - 1)) * 70
            return (
              <li key={s.key} className="flex flex-1 flex-col items-center">
                <p className="font-display text-[1.75rem] leading-none">{formatCount(s.count)}</p>
                <motion.div
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: rise }}
                  transition={{
                    delay: reduce ? 0 : i * 0.07,
                    type: 'spring',
                    stiffness: 140,
                    damping: 18,
                  }}
                  className={cn('relative mt-2 w-full overflow-hidden rounded-t-[8px]', s.tone)}
                  style={{ opacity: 0.35 + 0.65 * (s.count / max) }}
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-white/40" aria-hidden />
                </motion.div>
                <p className="mt-2 font-mono text-[0.75rem] font-semibold">{s.label}</p>
                <p className="text-center text-[0.625rem] leading-tight text-board-ink/65">
                  {s.sub}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
