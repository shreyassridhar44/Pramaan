import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

/**
 * A split-flap figure, like a railway departure board. Digits riffle through a few values before
 * settling whenever the value changes; other characters flip once. Screen readers get the value
 * as plain text.
 */
export function SplitFlap({
  value,
  variant = 'board',
  className,
  stagger = 45,
}: {
  value: string
  variant?: 'board' | 'inline'
  className?: string
  stagger?: number
}) {
  const chars = [...value]
  return (
    <span className={cn('inline-flex items-baseline', className)}>
      <span className="sr-only">{value}</span>
      <span
        aria-hidden
        className={cn('inline-flex', variant === 'board' ? 'gap-[0.08em]' : 'gap-0')}
      >
        {chars.map((ch, i) => (
          <FlapCell
            // Cells are keyed from the right so units stay put while digits are added in front.
            key={chars.length - i}
            ch={ch}
            delay={i * stagger}
            board={variant === 'board'}
          />
        ))}
      </span>
    </span>
  )
}

const DIGIT = /\d/

function FlapCell({ ch, delay, board }: { ch: string; delay: number; board: boolean }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(() => (reduce || !DIGIT.test(ch) ? ch : '0'))
  const [flip, setFlip] = useState(0)
  const first = useRef(true)

  useEffect(() => {
    const isFirst = first.current
    first.current = false
    if (reduce) {
      setShown(ch)
      return
    }
    if (!DIGIT.test(ch)) {
      setShown(ch)
      if (!isFirst) setFlip((f) => f + 1)
      return
    }
    const steps = 3 + Math.floor(Math.random() * 5)
    let n = 0
    let timer = window.setTimeout(function step() {
      n += 1
      setShown(n >= steps ? ch : String(Math.floor(Math.random() * 10)))
      setFlip((f) => f + 1)
      if (n < steps) timer = window.setTimeout(step, 60)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [ch, delay, reduce])

  const space = ch === ' '
  if (!board)
    return (
      <span
        className={cn('inline-block text-center tabular', DIGIT.test(ch) && 'w-[0.56em]')}
        style={{ perspective: '400px' }}
      >
        <span key={flip} className={flip ? 'flap-glyph' : undefined}>
          {shown === ' ' ? ' ' : shown}
        </span>
      </span>
    )
  return (
    <span
      className={cn(
        'relative inline-flex h-[1.25em] items-center justify-center overflow-hidden rounded-[0.12em] font-mono leading-none',
        space
          ? 'w-[0.3em]'
          : 'w-[0.74em] bg-board text-board-ink shadow-[inset_0_-1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.35)]',
      )}
      style={{ perspective: '400px' }}
    >
      {space ? null : (
        <>
          <span key={flip} className={flip ? 'flap-glyph' : undefined}>
            {shown}
          </span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-black/60" />
          <span className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.04]" />
        </>
      )}
    </span>
  )
}
