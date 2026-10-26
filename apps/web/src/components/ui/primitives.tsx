import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { RosetteMark } from '@/components/security/guilloche'

import { Button } from './button'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-panel)] border border-line bg-surface shadow-[0_1px_0_rgb(18_23_38/0.03),0_12px_32px_-28px_rgb(18_23_38/0.45)]',
        className,
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  caption,
  actions,
  className,
}: {
  title: ReactNode
  caption?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'relative flex items-start justify-between gap-4 overflow-hidden rounded-t-[var(--radius-panel)] px-5 pt-4 pb-3',
        className,
      )}
    >
      {typeof title === 'string' ? (
        <RosetteMark
          seed={title}
          layers={2}
          className="absolute -top-16 -right-12 size-[150px]"
          color="var(--guilloche-soft)"
        />
      ) : null}
      <div className="relative min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {caption ? <p className="mt-0.5 text-[0.8125rem] text-ink-3">{caption}</p> : null}
      </div>
      {actions ? <div className="relative flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Label({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'text-[0.6875rem] font-medium tracking-[0.06em] text-ink-3 uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-sunken motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-2">
      {children}
    </kbd>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="mb-1 text-ink-3 [&_svg]:size-6">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="max-w-sm text-[0.8125rem] text-ink-3">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown
  onRetry?: () => void
  compact?: boolean
}) {
  const e = error as { message?: string; requestId?: string }
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
      )}
    >
      <AlertTriangle className="size-5 text-overdue" aria-hidden />
      <p className="text-sm font-medium text-ink">This could not be loaded.</p>
      <p className="max-w-sm text-[0.8125rem] text-ink-3">
        {e?.message ?? 'Something went wrong.'}
        {e?.requestId ? <span className="font-mono"> Request {e.requestId}</span> : null}
      </p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry} className="mt-1">
          <RefreshCw /> Try again
        </Button>
      ) : null}
    </div>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider

export function Tip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-[0.75rem] leading-snug text-canvas shadow-[var(--shadow-overlay)]"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
