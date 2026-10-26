import { cn } from '@/lib/cn'

const MICRO = 'Pramaan  AICTE Regulation Bureau  Security deposit and FDR portal  प्रमाण  '

/**
 * A line of microprint: text too small to read at a glance that resolves under zoom, as on a
 * cheque or banknote. Decorative, hidden from assistive technology.
 */
export function Microprint({ text = MICRO, className }: { text?: string; className?: string }) {
  return <div aria-hidden className={cn('microprint', className)} data-micro={text.repeat(24)} />
}

/** The windowed, colour-shifting thread woven into a note. */
export function SecurityThread({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('security-thread block w-[3px] rounded-full', className)} />
  )
}

/** Saffron, white and green, as a hairline. */
export function Tricolour({ className }: { className?: string }) {
  return <div aria-hidden className={cn('tricolour h-[3px] w-full', className)} />
}
