import { ChevronDown, KeyRound, ShieldCheck, ShieldX } from 'lucide-react'
import { useState } from 'react'

import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/cn'
import { formatDate, formatRupeeText } from '@/lib/format'

import { SimulatedBadge } from './chips'

type Msg = components['schemas']['MessageOut']

const ROWS: [string, string][] = [
  ['number', 'Deposit number'],
  ['holders', 'Holders'],
  ['amount', 'Amount'],
  ['issue_date', 'Issue date'],
  ['maturity_date', 'Maturity date'],
  ['lien_in_favour_of_aicte', 'Lien in favour of AICTE'],
  ['encumbrance', 'Encumbrance'],
  ['deposit_status', 'Deposit status'],
  ['lien_discharged', 'Lien discharged'],
]

const DATES = new Set(['issue_date', 'maturity_date'])

/** Readable form of a signed value. The raw message below keeps the exact text that was signed. */
function shown(k: string, v: string) {
  if (k === 'amount') return formatRupeeText(v)
  if (DATES.has(k) && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v)
  return v
}

/** A bank response shown like a statement extract, with its signature check and the raw message. */
export function BankMessage({
  message,
  bank,
  simulated,
  conflicts = [],
}: {
  message: Msg
  bank: string
  simulated: boolean
  conflicts?: string[]
}) {
  const [raw, setRaw] = useState(false)
  const p = message.payload as Record<string, string>
  const notFound = p.result === 'not_found'
  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sunken/50 px-5 py-3">
        <div>
          <p className="text-[0.875rem] font-semibold text-ink">{bank}</p>
          <p className="text-[0.75rem] text-ink-3">
            {p.message_type === 'discharge_confirmation'
              ? 'Lien discharge confirmation'
              : 'Deposit confirmation'}{' '}
            · received {formatDate(message.received_on)}
            {p.answered_by ? ` · answered by ${p.answered_by}` : ' · answered automatically'}
          </p>
        </div>
        {simulated ? <SimulatedBadge /> : null}
      </header>
      {notFound ? (
        <p className="px-5 py-4 text-[0.875rem] font-medium text-overdue">
          The bank reports no deposit with number {p.number}.
        </p>
      ) : (
        <dl className="grid gap-x-8 px-5 py-3 text-[0.8125rem] sm:grid-cols-2">
          {ROWS.filter(([k]) => p[k] !== undefined).map(([k, label]) => {
            const bad = conflicts.includes(k === 'lien_in_favour_of_aicte' ? 'lien' : k)
            return (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-2">
                <dt className="text-ink-3">{label}</dt>
                <dd
                  className={cn(
                    'text-right font-mono',
                    bad ? 'font-semibold text-overdue' : 'text-ink',
                  )}
                >
                  {shown(k, p[k]!)}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-2.5 text-[0.75rem]">
        {message.signature_valid ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-a2">
            <ShieldCheck className="size-4" /> Ed25519 signature valid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium text-overdue">
            <ShieldX className="size-4" /> Signature does not verify
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 font-mono text-ink-3">
          <KeyRound className="size-3.5" /> {message.key_id}
        </span>
        <span className="font-mono text-ink-3">sig {message.signature.slice(0, 18)}</span>
        <button
          type="button"
          onClick={() => setRaw((r) => !r)}
          className="ml-auto inline-flex items-center gap-1 text-brand hover:underline"
          aria-expanded={raw}
        >
          Raw message{' '}
          <ChevronDown className={cn('size-3.5 transition-transform', raw && 'rotate-180')} />
        </button>
      </footer>
      {raw ? (
        <pre className="max-h-72 overflow-auto border-t border-line bg-sunken px-5 py-3 font-mono text-[0.6875rem] leading-relaxed text-ink-2">
          {JSON.stringify(message.payload, null, 2)}
          {'\n\nsignature: '}
          {message.signature}
        </pre>
      ) : null}
    </article>
  )
}
