import { Contrast } from 'lucide-react'

import { cn } from '@/lib/cn'
import { setTextSize, useTextSize, type TextSize } from '@/lib/text-size'
import { useTheme } from '@/lib/theme'

const SIZES: { size: TextSize; label: string; name: string }[] = [
  { size: 'small', label: 'A-', name: 'Smaller text' },
  { size: 'normal', label: 'A', name: 'Normal text' },
  { size: 'large', label: 'A+', name: 'Larger text' },
]

/**
 * The government website strip (GIGW): who runs the service, skip to content, text size and
 * contrast.
 */
export function GovStrip({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const size = useTextSize()
  const { theme, toggle } = useTheme()
  return (
    <div className={cn('relative z-40 bg-board text-board-ink', className)}>
      <div className="tricolour h-[3px] w-full" aria-hidden />
      <div className="mx-auto flex h-8 max-w-[1600px] items-center gap-4 px-4 text-[0.6875rem] sm:px-6">
        <a
          href="#main"
          className="sr-only rounded bg-surface px-2 py-1 text-ink focus:not-sr-only focus:absolute focus:top-1.5 focus:left-4"
        >
          Skip to main content
        </a>
        <p className="flex min-w-0 items-center gap-2 truncate">
          <span lang="hi" className="font-deva text-[0.75rem] opacity-90">
            भारत सरकार
          </span>
          <span className="opacity-40">|</span>
          <span className="truncate opacity-80">
            {compact
              ? 'AICTE, Ministry of Education'
              : 'All India Council for Technical Education, Ministry of Education, Government of India'}
          </span>
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div role="group" aria-label="Text size" className="flex items-center">
            {SIZES.map((s) => (
              <button
                key={s.size}
                type="button"
                aria-label={s.name}
                aria-pressed={size === s.size}
                onClick={() => setTextSize(s.size)}
                className={cn(
                  'grid h-6 min-w-6 place-items-center rounded px-1 font-semibold leading-none',
                  size === s.size
                    ? 'bg-board-ink/15 text-board-ink'
                    : 'text-board-ink/70 hover:bg-board-ink/10 hover:text-board-ink',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="mx-1 h-3.5 w-px bg-board-ink/20" aria-hidden />
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'command' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'command' ? 'Light theme' : 'Dark theme'}
            className="grid size-6 place-items-center rounded text-board-ink/70 hover:bg-board-ink/10 hover:text-board-ink"
          >
            <Contrast className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
