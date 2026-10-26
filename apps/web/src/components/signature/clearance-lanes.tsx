import {
  Check,
  Coins,
  Gavel,
  Hourglass,
  Landmark,
  MessageSquareWarning,
  ShieldCheck,
  X,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { Seal } from '@/components/security/seal'
import { RubberStamp } from '@/components/security/stamp'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

export type Lane = {
  cell: string
  label: string
  status: string
  officer?: string | null
  reason?: string | null
  decided_on?: string | null
  hint?: string | null
}

type NodeState = 'done' | 'ready' | 'waiting' | 'blocked' | 'idle'

const ICON: Record<string, ReactNode> = {
  pgrc: <MessageSquareWarning className="size-4" />,
  vigilance: <ShieldCheck className="size-4" />,
  grants: <Coins className="size-4" />,
}

const LANE_H = 92
const GAP = 12
const HEIGHT = LANE_H * 3 + GAP * 2

function stroke(status: string) {
  if (status === 'cleared') return 'var(--a2)'
  if (status === 'blocked') return 'var(--overdue)'
  return 'var(--line-strong)'
}

/** Three clearance lanes (PGRC, Vigilance, Grants) feeding the authorisation node, then the bank's
 * discharge. Each lane shows its state, officer, date and reason (PROTOTYPE.md 3.9). */
export function ClearanceLanes({
  lanes,
  authorisation,
  discharge,
  authority,
}: {
  lanes: Lane[]
  authorisation: NodeState
  discharge: NodeState
  authority: string
}) {
  const reduce = useReducedMotion()
  return (
    // Container queries: the lanes sit in panels of different widths across the officer, cell and
    // portal layouts, so the layout follows the panel rather than the viewport.
    <div className="@container">
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_72px_200px_40px_180px] @3xl:items-center @3xl:gap-0">
        <ol className="grid gap-3" aria-label="Clearances">
          {lanes.map((l) => (
            <li
              key={l.cell}
              className={cn(
                'relative flex gap-3 rounded-[var(--radius-panel)] border bg-surface px-4 py-3 @3xl:h-[92px] @3xl:overflow-hidden',
                l.status === 'cleared' && 'border-a2/40',
                l.status === 'blocked' && 'border-overdue/50 bg-overdue-soft/40',
                l.status === 'pending' && 'border-line',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                  l.status === 'cleared' && 'bg-a2-soft text-a2',
                  l.status === 'blocked' && 'bg-overdue-soft text-overdue',
                  l.status === 'pending' && 'bg-sunken text-ink-3',
                )}
              >
                {ICON[l.cell]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.875rem] font-semibold text-ink">{l.label}</p>
                  <LaneState status={l.status} />
                </div>
                {l.status === 'pending' ? (
                  <p className="mt-1 text-[0.75rem] text-ink-3">{l.hint || 'Awaiting the cell'}</p>
                ) : (
                  <>
                    <p className="mt-1 text-[0.75rem] text-ink-2">
                      {l.officer ?? 'Cell officer'}
                      {l.decided_on ? ` · ${formatDate(l.decided_on)}` : ''}
                    </p>
                    {l.reason ? (
                      <p
                        className="mt-0.5 line-clamp-2 text-[0.75rem] text-ink-3 @3xl:line-clamp-1"
                        title={l.reason}
                      >
                        {l.reason}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              {l.status !== 'pending' ? (
                <span
                  className="pointer-events-none absolute top-1/2 right-[104px] w-[90px] -translate-y-1/2 opacity-80"
                  aria-hidden
                >
                  <RubberStamp
                    title={l.status === 'cleared' ? 'Cleared' : 'Blocked'}
                    ink={l.status === 'cleared' ? 'green' : 'red'}
                    rotate={-8}
                    stamp={!reduce}
                    className="h-[40px]"
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        <svg
          viewBox={`0 0 72 ${HEIGHT}`}
          width={72}
          height={HEIGHT}
          className="hidden @3xl:block"
          aria-hidden
        >
          {lanes.map((l, i) => {
            const y = LANE_H / 2 + i * (LANE_H + GAP)
            const d = `M0 ${y} C 40 ${y}, 32 ${HEIGHT / 2}, 72 ${HEIGHT / 2}`
            return (
              <g key={l.cell}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={stroke(l.status)}
                  strokeWidth={l.status === 'pending' ? 1.5 : 2}
                  strokeDasharray={l.status === 'pending' ? '4 4' : undefined}
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.2, 0, 0, 1] }}
                />
                {l.status === 'cleared' ? (
                  <path
                    d={d}
                    fill="none"
                    stroke="var(--board-ink)"
                    strokeWidth="2"
                    strokeDasharray="2 12"
                    className="flow-dash"
                    opacity="0.9"
                  />
                ) : null}
              </g>
            )
          })}
        </svg>

        <FlowNode
          state={authorisation}
          icon={<Gavel className="size-5" />}
          title="Authorisation"
          caption={
            authorisation === 'done'
              ? authority.replace('by the', 'issued by the')
              : authorisation === 'ready'
                ? 'Every condition met. Ready for the competent authority'
                : authorisation === 'blocked'
                  ? 'Blocked until the cell lifts its objection'
                  : 'Waiting for every clearance'
          }
        />

        <div className="hidden h-px bg-line-strong @3xl:block" aria-hidden>
          <div
            className={cn(
              'h-px transition-all duration-500',
              authorisation === 'done' ? 'w-full bg-a2' : 'w-0',
            )}
          />
        </div>

        <FlowNode
          state={discharge}
          icon={<Landmark className="size-5" />}
          title="Bank discharge"
          caption={
            discharge === 'done'
              ? 'Lien discharged and deposit released'
              : discharge === 'waiting'
                ? 'Waiting for the bank to confirm'
                : 'After authorisation'
          }
        />
      </div>
    </div>
  )
}

function LaneState({ status }: { status: string }) {
  if (status === 'cleared')
    return (
      <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-a2">
        <Check className="size-3.5" /> Cleared
      </span>
    )
  if (status === 'blocked')
    return (
      <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-overdue">
        <X className="size-3.5" /> Blocked
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-ink-3">
      <Hourglass className="size-3.5" /> Awaiting
    </span>
  )
}

function FlowNode({
  state,
  icon,
  title,
  caption,
}: {
  state: NodeState
  icon: ReactNode
  title: string
  caption: string
}) {
  return (
    <div
      className={cn(
        'relative rounded-[var(--radius-panel)] border px-4 py-4 text-center',
        state === 'done' && 'border-a2/50 bg-a2-soft/50',
        state === 'ready' &&
          'border-accent bg-accent-soft/50 shadow-[0_0_0_4px_var(--accent-soft)]',
        state === 'blocked' && 'border-overdue/50 bg-overdue-soft/40',
        (state === 'waiting' || state === 'idle') && 'border-line bg-surface',
      )}
    >
      <span
        className={cn(
          'mx-auto grid size-10 place-items-center rounded-full',
          state === 'done' && 'bg-a2 text-white',
          state === 'ready' && 'bg-accent text-white',
          state === 'blocked' && 'bg-overdue text-white',
          (state === 'waiting' || state === 'idle') && 'bg-sunken text-ink-3',
        )}
      >
        {state === 'done' ? <Check className="size-5" /> : icon}
      </span>
      {state === 'done' ? (
        <span className="pointer-events-none absolute top-2 right-2" aria-hidden>
          <Seal size={64} tone="green" stamp seed={title} legend={`${title}  •  Done  •  `} />
        </span>
      ) : null}
      <p className="mt-2 text-[0.875rem] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[0.75rem] leading-snug text-ink-3">{caption}</p>
    </div>
  )
}
