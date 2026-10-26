import { rosetteLayerPaths } from '@/lib/guilloche'
import { cn } from '@/lib/cn'

// The mark's rosette is fixed, so it is computed once.
const ROSETTE = rosetteLayerPaths(
  { radius: 58, petals: 12, counter: 4, depth: 10, ripple: 4, strands: 7 },
  0.5,
)

/** The Pramaan mark: an office seal with a guilloche rosette closing around a tick. */
export function PramaanMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <circle cx="100" cy="100" r="98" fill="var(--brand)" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="var(--saffron)" strokeWidth="5" />
      <circle
        cx="100"
        cy="100"
        r="82"
        fill="none"
        stroke="var(--brand-contrast)"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <g
        fill="none"
        stroke="var(--brand-contrast)"
        strokeOpacity="0.55"
        strokeWidth={size < 40 ? 3 : 1.4}
      >
        {ROSETTE.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path
        d="M70 102 L92 124 L134 78"
        fill="none"
        stroke="var(--saffron)"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ className, sub }: { className?: string; sub?: boolean }) {
  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span className="inline-flex items-baseline gap-2">
        <span className="font-display text-[1.375rem] leading-none tracking-[-0.01em] text-ink">
          Pramaan
        </span>
        <span lang="hi" className="font-deva text-[0.8125rem] leading-none text-ink-3">
          प्रमाण
        </span>
      </span>
      {sub ? (
        <span className="mt-1 text-[0.625rem] font-medium tracking-[0.08em] text-ink-3 uppercase">
          AICTE Regulation Bureau
        </span>
      ) : null}
    </span>
  )
}
