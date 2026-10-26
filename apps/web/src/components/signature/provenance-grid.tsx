import {
  AlertOctagon,
  Check,
  Clock,
  FileText,
  Landmark,
  Minus,
  Pencil,
  PenLine,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { Tip } from '@/components/ui/primitives'
import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

type Row = components['schemas']['ProvenanceRow']
type Value = components['schemas']['SourceValue']
type Diff = components['schemas']['DiffRun']

const SOURCES = [
  { key: 'declared', label: 'Declared', sub: 'by the institution', icon: PenLine },
  { key: 'extracted', label: 'Extracted', sub: 'from the document', icon: FileText },
  { key: 'confirmed', label: 'Confirmed', sub: 'by the issuing bank', icon: Landmark },
] as const

const STATE: Record<string, { label: string; icon: ReactNode; cls: string }> = {
  match: { label: 'Match', icon: <Check className="size-3.5" />, cls: 'text-a2 bg-a2-soft' },
  conflict: {
    label: 'Conflict',
    icon: <AlertOctagon className="size-3.5" />,
    cls: 'text-overdue bg-overdue-soft',
  },
  pending: {
    label: 'Not yet observed',
    icon: <Clock className="size-3.5" />,
    cls: 'text-ink-3 bg-sunken',
  },
  missing: { label: 'Missing', icon: <Minus className="size-3.5" />, cls: 'text-ink-3 bg-sunken' },
}

function DiffText({ runs }: { runs: Diff[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.changed ? (
          <mark key={i} className="rounded-[3px] bg-overdue px-0.5 text-white">
            {r.text}
          </mark>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  )
}

function Cell({
  value,
  diff,
  conflict,
  source,
}: {
  value: Value | null | undefined
  diff?: Diff[] | null
  conflict: boolean
  source: (typeof SOURCES)[number]
}) {
  const reduce = useReducedMotion()
  if (!value) {
    return (
      <span className="text-[0.8125rem] text-ink-3">
        {source.key === 'declared' ? 'Not entered' : 'Not observed'}
      </span>
    )
  }
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-w-0"
    >
      <p
        className={cn(
          'truncate font-mono text-[0.8125rem]',
          conflict && diff ? 'text-overdue' : 'text-ink',
        )}
      >
        {diff ? <DiffText runs={diff} /> : conflict ? value.display : value.raw}
      </p>
      {value.corrected_by || value.corrected_from ? (
        <Tip content={value.note ? `Reason: ${value.note}` : 'No reason recorded'}>
          <p className="mt-0.5 truncate text-[0.6875rem] font-medium text-due">
            {value.evidence_type === 'resubmission' ? 'Resubmitted' : 'Corrected'}
            {value.corrected_from ? ` from ${value.corrected_from}` : ''}
            {value.corrected_by ? ` by ${value.corrected_by}` : ''}
          </p>
        </Tip>
      ) : null}
      <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-ink-3">
        {formatDate(value.observed_on)}
        {value.confidence != null ? (
          <Tip content="OCR confidence for this field">
            <span className="rounded bg-sunken px-1 font-mono">
              {Math.round(value.confidence * 100)}%
            </span>
          </Tip>
        ) : null}
      </p>
    </motion.div>
  )
}

/**
 * Field-level provenance: for every material field, what the institution declared, what was read
 * from the receipt and what the bank confirmed, side by side. A declared value is never shown in
 * the confirmed column. Conflicting characters are highlighted.
 */
export function ProvenanceGrid({
  rows,
  onCorrect,
}: {
  rows: Row[]
  /** When given, permitted fields show a correct button (officers only, on today's view). */
  onCorrect?: (row: Row) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] table-fixed text-left">
        <colgroup>
          <col className="w-[180px]" />
          <col />
          <col />
          <col />
          <col className="w-[150px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line">
            <th className="px-5 py-3 text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
              Field
            </th>
            {SOURCES.map((s) => (
              <th key={s.key} className="px-4 py-3">
                <span className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink">
                  <s.icon className="size-3.5 text-ink-3" aria-hidden /> {s.label}
                </span>
                <span className="block pl-[22px] text-[0.6875rem] font-normal text-ink-3">
                  {s.sub}
                </span>
              </th>
            ))}
            <th className="px-5 py-3 text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
              State
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conflict = r.state === 'conflict'
            const st = STATE[r.state] ?? STATE.missing!
            return (
              <tr
                key={r.field}
                className={cn(
                  'border-b border-line last:border-0',
                  conflict && 'bg-overdue-soft/40',
                )}
              >
                <th scope="row" className="px-5 py-3 text-[0.8125rem] font-medium text-ink-2">
                  <span className="flex items-center justify-between gap-2">
                    {r.label}
                    {onCorrect && r.correctable ? (
                      <button
                        type="button"
                        onClick={() => onCorrect(r)}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
                        aria-label={`Correct ${r.label.toLowerCase()}`}
                        title="Correct the declared value"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                </th>
                <td className="px-4 py-3">
                  <Cell value={r.declared} conflict={conflict} source={SOURCES[0]} />
                </td>
                <td className="px-4 py-3">
                  <Cell
                    value={r.extracted}
                    diff={r.diff_extracted}
                    conflict={conflict}
                    source={SOURCES[1]}
                  />
                </td>
                <td className="px-4 py-3">
                  <Cell
                    value={r.confirmed}
                    diff={r.diff_confirmed}
                    conflict={conflict}
                    source={SOURCES[2]}
                  />
                </td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-medium',
                      st.cls,
                    )}
                  >
                    {st.icon}
                    {st.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
