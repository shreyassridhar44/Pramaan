import { cn } from '@/lib/cn'

/** The Pramaan mark: a proof ring closing around a tick. */
export function PramaanMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke="var(--brand-contrast)"
        strokeWidth="2.2"
        strokeDasharray="14 2.6"
        transform="rotate(-90 16 16)"
      />
      <path
        d="M11.8 16.3l2.9 2.9 5.6-6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-display text-[1.375rem] leading-none tracking-[-0.01em] text-ink">
        Pramaan
      </span>
      <span lang="hi" className="font-deva text-[0.8125rem] leading-none text-ink-3">
        प्रमाण
      </span>
    </span>
  )
}
