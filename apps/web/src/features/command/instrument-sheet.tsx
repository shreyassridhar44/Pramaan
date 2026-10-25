import * as Dialog from '@radix-ui/react-dialog'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { StatusChip } from '@/components/signature/chips'
import { ProvenanceGrid } from '@/components/signature/provenance-grid'
import { ErrorState, Skeleton } from '@/components/ui/primitives'
import { ActionBar, SignalsPanel } from '@/features/instruments/officer-actions'
import { useInstrument } from '@/features/instruments/queries'
import { useAsOf } from '@/lib/asof'
import { formatDate, formatINR } from '@/lib/format'

/** An instrument opened beside the command view, so the officer keeps their place (5.2). */
export function InstrumentSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const reduce = useReducedMotion()
  return (
    <Dialog.Root open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20" />
        <Dialog.Content asChild aria-describedby={undefined}>
          <motion.div
            initial={reduce ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-[760px] max-w-full flex-col overflow-y-auto border-l border-line bg-canvas shadow-[var(--shadow-overlay)]"
          >
            {id !== null ? <SheetBody id={id} /> : null}
            <Dialog.Close
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SheetBody({ id }: { id: number }) {
  const q = useInstrument(id)
  const { asOf, isToday } = useAsOf()
  if (q.isError)
    return (
      <div className="p-6">
        <Dialog.Title className="sr-only">Instrument</Dialog.Title>
        <ErrorState error={q.error} />
      </div>
    )
  if (!q.data)
    return (
      <div className="grid gap-4 p-6">
        <Dialog.Title className="sr-only">Loading instrument</Dialog.Title>
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    )
  const d = q.data
  const level = d.assurance as AssuranceLevel
  return (
    <div className="grid gap-5 p-6">
      <div className="flex items-start gap-4 pr-10">
        <AssuranceRing level={level} size={56} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={d.status} />
            <span className="text-[0.75rem] text-ink-3">
              {ASSURANCE[level].short} {ASSURANCE[level].name}
            </span>
          </div>
          <Dialog.Title className="mt-1 font-mono text-[1.125rem] text-ink">
            {d.number}
          </Dialog.Title>
          <p className="text-[0.875rem] text-ink-2">
            {d.institution} · {d.bank}
          </p>
          <p className="mt-1 text-[0.8125rem] text-ink-3">
            <span className="font-display text-[1.5rem] text-ink">{formatINR(d.amount_paise)}</span>{' '}
            · matures {formatDate(d.maturity_date)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActionBar d={d} />
        <Link
          to="/instruments/$instrumentId"
          params={{ instrumentId: String(d.id) }}
          search={isToday ? {} : { asOf }}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand hover:underline"
        >
          Open full record <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <SignalsPanel d={d} />
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
        <ProvenanceGrid rows={d.provenance} />
      </div>
    </div>
  )
}
