import { FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { formatINR, formatINRCompact } from '@/lib/format'

import { STATUS, type Tone } from './status-meta'

const TONES: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2',
  info: 'bg-a1-soft text-a1',
  ok: 'bg-a2-soft text-a2',
  due: 'bg-due-soft text-due',
  overdue: 'bg-overdue-soft text-overdue',
  simulated: 'bg-simulated-soft text-simulated',
  brand: 'bg-accent-soft text-accent',
}

export function Chip({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return (
    <Chip tone={s.tone} dot className={className}>
      {s.label}
    </Chip>
  )
}

export function SeverityChip({ severity }: { severity: string }) {
  const tone: Tone = severity === 'high' ? 'overdue' : severity === 'medium' ? 'due' : 'neutral'
  return (
    <Chip tone={tone} dot>
      {severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low'}
    </Chip>
  )
}

/** Every simulated surface carries this label (CLAUDE.md product rule). */
export function SimulatedBadge({ label = 'Simulated bank' }: { label?: string }) {
  return (
    <Chip tone="simulated">
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </Chip>
  )
}

export function Amount({
  paise,
  compact,
  className,
}: {
  paise: string | number | bigint
  compact?: boolean
  className?: string
}) {
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {compact ? formatINRCompact(paise) : formatINR(paise)}
    </span>
  )
}
