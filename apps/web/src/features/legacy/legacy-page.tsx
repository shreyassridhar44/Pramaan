import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Sparkles,
  UploadCloud,
  type LucideIcon,
  CircleCheck,
  CircleAlert,
  CirclePlus,
  Copy,
  CircleX,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useRef, useState, type DragEvent } from 'react'

import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { SplitFlap } from '@/components/security/split-flap'
import { Button } from '@/components/ui/button'
import { ErrorState, Panel, PanelHeader } from '@/components/ui/primitives'
import type { ApiError } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { postFile } from '@/lib/api/upload'
import { cn } from '@/lib/cn'
import { formatCount, formatDate, formatINR, formatINRCompact } from '@/lib/format'

type Report = components['schemas']['ReconcileReport']
type Outcome = 'match' | 'differs' | 'new' | 'duplicate' | 'incomplete'

const OUTCOME: Record<
  Outcome,
  {
    code: string
    label: string
    hint: string
    icon: LucideIcon
    tile: string
    text: string
    soft: string
  }
> = {
  match: {
    code: 'm',
    label: 'Matches Pramaan',
    hint: 'Same deposit, same values',
    icon: CircleCheck,
    tile: 'bg-a2',
    text: 'text-a2',
    soft: 'bg-a2-soft',
  },
  differs: {
    code: 'd',
    label: 'Values differ',
    hint: 'Same deposit, a value disagrees',
    icon: CircleAlert,
    tile: 'bg-due',
    text: 'text-due',
    soft: 'bg-due-soft',
  },
  new: {
    code: 'n',
    label: 'Not in Pramaan',
    hint: 'Held on paper only',
    icon: CirclePlus,
    tile: 'bg-a1',
    text: 'text-a1',
    soft: 'bg-a1-soft',
  },
  duplicate: {
    code: 'u',
    label: 'Repeated rows',
    hint: 'Same deposit entered twice',
    icon: Copy,
    tile: 'bg-simulated',
    text: 'text-simulated',
    soft: 'bg-simulated-soft',
  },
  incomplete: {
    code: 'i',
    label: 'Cannot be used',
    hint: 'Number or amount missing',
    icon: CircleX,
    tile: 'bg-overdue',
    text: 'text-overdue',
    soft: 'bg-overdue-soft',
  },
}
const ORDER: Outcome[] = ['match', 'differs', 'new', 'duplicate', 'incomplete']
const FROM_CODE = Object.fromEntries(ORDER.map((o) => [OUTCOME[o].code, o])) as Record<
  string,
  Outcome
>
const FIELD: Record<string, string> = {
  amount_paise: 'Amount',
  issue_date: 'Issue date',
  maturity_date: 'Maturity',
}

function showValue(field: string, v: string) {
  if (v === 'blank') return 'blank'
  if (field === 'amount_paise') return formatINR(v)
  return formatDate(v)
}

/**
 * Bringing legacy registers in (R14): drop a spreadsheet kept by any desk and see every row
 * reconciled against Pramaan, drawn as one tile per row. A dry run: nothing is written.
 */
export function LegacyImportPage() {
  const [filter, setFilter] = useState<Outcome | 'attention'>('attention')
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const run = useMutation({
    mutationFn: async (file: File) => postFile<Report>('/api/v1/legacy/reconcile', file),
  })
  const sample = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/legacy/sample', { credentials: 'include' })
      if (!res.ok) throw new Error('The sample register is not available.')
      const blob = await res.blob()
      run.mutate(new File([blob], 'legacy-fdr-register-sample.xlsx'))
    },
  })
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) run.mutate(f)
  }
  const report = run.data
  return (
    <div className="grid gap-5">
      <Panel className="relative overflow-hidden bg-paper">
        <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden />
        <RosetteMark seed="legacy" className="absolute -top-24 -right-24 size-[420px] opacity-80" />
        <GuillocheBand height={16} className="relative" />
        <div className="relative grid gap-8 p-7 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-accent uppercase">
              Migration, without retyping (R14)
            </p>
            <h2 className="mt-2 font-display text-[2.5rem] leading-[1.02] text-ink">
              Bring the old registers in. Pramaan checks every row.
            </h2>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">
              Deposits are tracked today in spreadsheets kept by different desks, each with its own
              columns, number formats and date styles. Drop one here: Pramaan reads it as written,
              matches each row to the deposit it describes, and shows what agrees, what differs, and
              what exists only on paper.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => sample.mutate()}
                disabled={run.isPending || sample.isPending}
              >
                <Sparkles /> Reconcile the sample register
              </Button>
              <Button asChild size="lg">
                <a href="/api/v1/legacy/sample" download>
                  <Download /> Open the sample in Excel
                </a>
              </Button>
            </div>
            <p className="mt-2 text-[0.75rem] text-ink-3">
              The sample is synthetic: about 1,050 rows drawn from the demo records and roughened
              the way hand-kept registers are.
            </p>
          </div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed bg-surface/70 p-8 text-center transition-colors',
              drag ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-ink-3',
            )}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-sunken text-ink-2">
              <UploadCloud className="size-7" />
            </span>
            <span className="text-[1rem] font-semibold text-ink">Drop a register here</span>
            <span className="text-[0.8125rem] text-ink-3">
              Excel (.xlsx) or CSV, up to 8 MB. Any column order; common header names are
              recognised.
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xlsm,.csv"
            className="sr-only"
            aria-label="Choose a register file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) run.mutate(f)
              e.target.value = ''
            }}
          />
        </div>
      </Panel>

      {run.isPending ? <Reading /> : null}
      {run.isError ? (
        <Panel>
          <ErrorState error={run.error as ApiError} />
        </Panel>
      ) : null}
      {report ? <Result report={report} filter={filter} onFilter={setFilter} /> : null}
    </div>
  )
}

function Reading() {
  return (
    <Panel className="flex items-center gap-4 p-6">
      <FileSpreadsheet className="size-6 animate-pulse text-accent motion-reduce:animate-none" />
      <p className="text-[0.9375rem] text-ink">Reading the register and matching every row</p>
    </Panel>
  )
}

function Result({
  report,
  filter,
  onFilter,
}: {
  report: Report
  filter: Outcome | 'attention'
  onFilter: (f: Outcome | 'attention') => void
}) {
  const counts = report.counts as Record<Outcome, number>
  const rows = useMemo(
    () =>
      report.findings.filter((f) =>
        filter === 'attention' ? f.outcome !== 'match' : f.outcome === filter,
      ),
    [report, filter],
  )
  const exportCsv = () => {
    const lines = [
      ['Line', 'Outcome', 'Deposit number', 'Institution', 'Detail'].join(','),
      ...report.findings
        .filter((f) => f.outcome !== 'match')
        .map((f) =>
          [
            f.line,
            OUTCOME[f.outcome as Outcome].label,
            f.number,
            f.institution,
            f.problem ??
              f.differences
                .map(
                  (d) =>
                    `${FIELD[d.field] ?? d.field}: register ${d.in_register}, Pramaan ${d.pramaan}`,
                )
                .join('; '),
          ]
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(','),
        ),
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'register-reconciliation.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <Panel className="overflow-hidden">
        <PanelHeader
          title={`${formatCount(report.rows_read)} rows reconciled in ${(report.elapsed_ms / 1000).toFixed(1)} s`}
          caption={`${report.filename}. One tile per row, in file order. Dry run: nothing has been written to Pramaan.`}
          actions={
            <Button size="sm" onClick={exportCsv}>
              <Download /> Rows needing attention (CSV)
            </Button>
          }
        />
        <div className="px-5 pb-5">
          <Mosaic sequence={report.sequence} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {ORDER.map((o) => {
              const m = OUTCOME[o]
              const active = filter === o
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFilter(active ? 'attention' : o)}
                  className={cn(
                    'rounded-[12px] border p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5',
                    active
                      ? 'border-ink shadow-[var(--shadow-lift)]'
                      : 'border-line hover:border-ink-3',
                  )}
                >
                  <span
                    className={cn('flex items-center gap-2 text-[0.75rem] font-semibold', m.text)}
                  >
                    <m.icon className="size-4" /> {m.label}
                  </span>
                  <span className="mt-2 block font-display text-[2.25rem] leading-none text-ink">
                    <SplitFlap value={formatCount(counts[o])} variant="inline" />
                  </span>
                  <span className="mt-1 block text-[0.75rem] text-ink-3">
                    {o === 'match'
                      ? `${formatINRCompact(report.matched_value_paise)} confirmed against the record`
                      : m.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title={filter === 'attention' ? 'Rows that need an officer' : OUTCOME[filter].label}
          caption="Differences show the register's value, struck through, beside Pramaan's. Pick a card above to see that group, including a sample of matching rows."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-y border-line bg-sunken/60 text-left text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
                <th className="px-5 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium">As written</th>
                <th className="px-3 py-2 font-medium">Institution</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
                <th className="px-3 py-2 font-medium">Detail</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((f) => {
                const m = OUTCOME[f.outcome as Outcome]
                return (
                  <tr
                    key={f.line}
                    className="border-b border-line last:border-0 hover:bg-sunken/40"
                  >
                    <td className="px-5 py-2.5 font-mono text-ink-3">{f.line}</td>
                    <td className="px-3 py-2.5 font-mono text-ink">{f.number || 'blank'}</td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 text-ink-2">
                      {f.institution}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75rem] font-medium',
                          m.soft,
                          m.text,
                        )}
                      >
                        <m.icon className="size-3.5" /> {m.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">
                      {f.problem ??
                        (f.differences.length
                          ? f.differences.map((d) => (
                              <span
                                key={d.field}
                                className="mr-3 inline-flex items-baseline gap-1.5"
                              >
                                <span className="text-ink-3">{FIELD[d.field] ?? d.field}</span>
                                <span className="font-mono text-due line-through decoration-due/50">
                                  {showValue(d.field, d.in_register)}
                                </span>
                                <span className="font-mono text-ink">
                                  {showValue(d.field, d.pramaan)}
                                </span>
                              </span>
                            ))
                          : f.amount_paise
                            ? formatINR(f.amount_paise)
                            : '')}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {f.instrument_id ? (
                        <Link
                          to="/instruments/$instrumentId"
                          params={{ instrumentId: String(f.instrument_id) }}
                          className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand hover:underline"
                        >
                          Record <ArrowUpRight className="size-3" />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[0.75rem] text-ink-3">
          In a live migration, matching rows add the register as a source for each value,
          differences go to the scrutiny queue, and rows held only on paper become draft records for
          the institution to confirm. Nothing is changed without an officer.
        </p>
      </Panel>
    </>
  )
}

/** The whole register as tiles, revealed in file order like a scanner passing over it. */
function Mosaic({ sequence }: { sequence: string }) {
  const reduce = useReducedMotion()
  const tiles = [...sequence]
  const total = tiles.length
  return (
    <div
      role="img"
      aria-label={`${total} rows drawn as tiles coloured by outcome`}
      className="flex flex-wrap gap-[3px] rounded-[12px] bg-sunken/60 p-3"
    >
      {tiles.map((c, i) => {
        const o = FROM_CODE[c] ?? 'incomplete'
        return (
          <motion.span
            key={i}
            initial={reduce ? false : { opacity: 0, scale: 0.2 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: reduce ? 0 : (i / total) * 2.4 }}
            className={cn(
              'size-[9px] rounded-[2px]',
              OUTCOME[o].tile,
              o === 'match' && 'opacity-80',
            )}
          />
        )
      })}
    </div>
  )
}
