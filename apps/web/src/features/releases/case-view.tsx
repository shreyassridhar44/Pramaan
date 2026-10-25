import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  BadgeCheck,
  Check,
  CircleDashed,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  FileX2,
  Gavel,
  Landmark,
  Send,
  ShieldX,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Amount, Chip, SimulatedBadge, StatusChip } from '@/components/signature/chips'
import { ClearanceLanes } from '@/components/signature/clearance-lanes'
import { Button } from '@/components/ui/button'
import { ErrorState, Label, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { ReasonDialog } from '@/features/instruments/officer-actions'
import { ApiError, api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate, formatINR } from '@/lib/format'
import { useMe } from '@/lib/session'

import { CASE_STATUS, EVENT_LABEL, KIND_LABEL } from './meta'
import { type ReleaseDetail, useCaseMutation, useRelease } from './queries'

type Mode = 'officer' | 'cell' | 'portal'

export function CaseView({ id, mode }: { id: number; mode: Mode }) {
  const q = useRelease(id, mode === 'portal')
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (!q.data) return <CaseSkeleton />
  return <CaseBody d={q.data} mode={mode} />
}

function CaseSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-52" />
      <Skeleton className="h-80" />
    </div>
  )
}

function CaseBody({ d, mode }: { d: ReleaseDetail; mode: Mode }) {
  const r = d.row
  const status = CASE_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const }
  const passed = d.checks.filter((c) => c.state === 'pass').length
  const done = r.status === 'authorised' || r.status === 'closed'
  const discharging = d.instruments_detail.some((i) => i.discharge_status === 'sent')
  const hintFor = (cell: string) =>
    d.checks.find((c) => c.code === `clearance_${cell}` && c.state !== 'pass')?.detail
  return (
    <div className="grid gap-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{KIND_LABEL[r.kind] ?? r.kind}</Chip>
              <Chip tone={status.tone} dot>
                {status.label}
              </Chip>
              <Chip tone="neutral">APH 2024-27 Clause 6.46</Chip>
            </div>
            <h1 className="mt-3 font-mono text-[1.375rem] font-medium tracking-tight text-ink">
              {r.reference}
            </h1>
            <p className="mt-1 text-[0.9375rem] text-ink-2">
              {mode === 'officer' ? (
                <Link
                  to="/institutions/$institutionId"
                  params={{ institutionId: String(r.institution_id) }}
                  className="font-medium text-ink hover:text-brand"
                >
                  {r.institution}
                </Link>
              ) : (
                <span className="font-medium text-ink">{r.institution}</span>
              )}
              <span className="text-ink-3">
                {' '}
                · {d.trust} · {r.region}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <Label>Amount to release</Label>
                <p className="mt-1 font-display text-[2.75rem] leading-none text-ink">
                  {formatINR(r.amount_paise)}
                </p>
              </div>
              <Fact
                label="Applied"
                value={formatDate(r.applied_on)}
                sub={`${r.days_open} day${r.days_open === 1 ? '' : 's'} ${done ? 'to decide' : 'open'}`}
              />
              <Fact label="Decided by" value={d.authority} sub={`AICTE ID ${d.aicte_id}`} />
            </div>
          </div>
          <Readiness d={d} passed={passed} mode={mode} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid content-start gap-5 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Clearances"
              caption="PGRC, Vigilance and the Grants bureaus each clear the case before the competent authority can act"
            />
            <div className="px-5 pb-5">
              <ClearanceLanes
                lanes={d.clearance_lanes.map((l) => ({ ...l, hint: hintFor(l.cell) }))}
                authority={d.authority}
                authorisation={
                  done
                    ? 'done'
                    : r.blocked
                      ? 'blocked'
                      : d.checks.every((c) => c.state === 'pass')
                        ? 'ready'
                        : 'waiting'
                }
                discharge={r.status === 'closed' ? 'done' : done ? 'waiting' : 'idle'}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader
              title="Conditions for release"
              caption="Computed by the rules engine from the case record. The engine never authorises; it only reports."
            />
            <ul className="px-5 pb-4">
              {d.checks.map((c) => (
                <li
                  key={c.code}
                  className="flex items-start gap-3 border-t border-line py-3 first:border-0"
                >
                  <CheckIcon state={c.state} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-medium text-ink">{c.label}</p>
                    <p
                      className={cn(
                        'text-[0.8125rem]',
                        c.state === 'fail' ? 'text-overdue' : 'text-ink-3',
                      )}
                    >
                      {c.detail}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-ink-3">
                    {c.aph_ref.replace('APH 2024-27 ', '')}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <InstrumentsPanel d={d} mode={mode} discharging={discharging} />
        </div>
        <div className="grid content-start gap-5 xl:col-span-4">
          <LettersPanel d={d} />
          <DocumentsPanel d={d} />
          {mode !== 'portal' ? <ComplaintsPanel d={d} mode={mode} /> : null}
          <TimelinePanel d={d} />
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className="mt-1 truncate text-[0.9375rem] font-medium text-ink">{value}</p>
      {sub ? <p className="mt-0.5 truncate font-mono text-[0.75rem] text-ink-3">{sub}</p> : null}
    </div>
  )
}

function CheckIcon({ state }: { state: string }) {
  if (state === 'pass')
    return (
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-a2 text-white">
        <Check className="size-3" />
      </span>
    )
  if (state === 'fail')
    return (
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-overdue text-white">
        <X className="size-3" />
      </span>
    )
  return <CircleDashed className="mt-0.5 size-5 shrink-0 text-due" />
}

/** The decision area: what this person can do now, or why nothing can be done yet. */
function Readiness({ d, passed, mode }: { d: ReleaseDetail; passed: number; mode: Mode }) {
  const me = useMe().data
  const total = d.checks.length
  const r = d.row
  return (
    <div className="flex flex-col justify-between gap-4 rounded-[var(--radius-panel)] border border-line bg-sunken/50 p-5">
      <div>
        <div className="flex items-baseline justify-between">
          <Label>Conditions met</Label>
          <span className="font-mono text-[0.8125rem] text-ink-2">
            {passed} of {total}
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {d.checks.map((c) => (
            <span
              key={c.code}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                c.state === 'pass' ? 'bg-a2' : c.state === 'fail' ? 'bg-overdue' : 'bg-line-strong',
              )}
            />
          ))}
        </div>
        <p className="mt-3 text-[0.8125rem] text-ink-2">
          {r.status === 'closed'
            ? 'Released. The bank has discharged the lien.'
            : r.status === 'authorised'
              ? 'Authorised. Waiting for the bank to discharge the lien.'
              : r.blocked
                ? 'Blocked. A cell has objected; the authority cannot act until it is lifted.'
                : passed === total
                  ? 'Every condition is met.'
                  : `Waiting for: ${d.checks
                      .filter((c) => c.state !== 'pass')
                      .map((c) => c.label)
                      .join(', ')}.`}
        </p>
      </div>
      {mode === 'cell' && d.my_cell ? <CellDecision d={d} /> : null}
      {mode === 'officer' && me?.role === 'approving_authority' ? <AuthorisePanel d={d} /> : null}
      {mode === 'officer' &&
      r.status === 'authorised' &&
      me &&
      ['bureau_officer', 'regional_officer', 'section_head', 'approving_authority'].includes(
        me.role,
      ) &&
      d.instruments_detail.some((i) => !i.discharge_status && !i.released_on) ? (
        <SendDischarge d={d} />
      ) : null}
    </div>
  )
}

function CellDecision({ d }: { d: ReleaseDetail }) {
  const cell = d.my_cell!
  const lane = d.clearance_lanes.find((l) => l.cell === cell)
  const [dialog, setDialog] = useState<'clear' | 'block' | null>(null)
  const decide = useCaseMutation(
    d.row.id,
    async (v: { decision: 'clear' | 'block'; reason: string }) =>
      unwrap(
        await api.POST('/api/v1/releases/{case_id}/clearances/{cell}', {
          params: { path: { case_id: d.row.id, cell } },
          body: v,
        }),
      ),
    'Decision recorded in the case and the audit trail.',
  )
  const closed = !['in_clearance', 'blocked', 'cleared'].includes(d.row.status)
  if (closed) return null
  return (
    <div className="grid gap-2">
      <p className="text-[0.75rem] text-ink-3">
        Your cell: <span className="font-medium text-ink">{lane?.label}</span> ·{' '}
        {lane?.status === 'pending' ? 'awaiting your decision' : `you ${lane?.status} this case`}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => setDialog('clear')}>
          <BadgeCheck /> Clear
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setDialog('block')}>
          <ShieldX /> Block
        </Button>
      </div>
      <ReasonDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'clear' ? 'Clear this case' : 'Block this case'}
        body={
          dialog === 'clear'
            ? 'Record why your cell has no objection. The reason is shown on the case and kept in the audit trail.'
            : 'State the objection. The institution and the authority will see it, and the case cannot be authorised until you lift it.'
        }
        confirm={dialog === 'clear' ? 'Clear' : 'Block'}
        onConfirm={(reason) =>
          decide.mutate({ decision: dialog!, reason }, { onSuccess: () => setDialog(null) })
        }
      />
    </div>
  )
}

function AuthorisePanel({ d }: { d: ReleaseDetail }) {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [issued, setIssued] = useState<{
    reference: string
    id: number
    url: string
    awaiting: number
  } | null>(null)
  const rtgs = d.row.kind === 'rtgs'
  const label = rtgs ? 'Issue sanction order' : 'Issue NOC'
  const go = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/releases/{case_id}/authorise', {
          params: { path: { case_id: d.row.id } },
          body: { note: note.trim() || null },
        }),
      ),
    onSuccess: (r) => {
      setConfirming(false)
      setIssued({
        reference: r.letter.reference,
        id: r.letter.id,
        url: r.letter.verify_url,
        awaiting: r.awaiting_bank,
      })
      void qc.invalidateQueries({ queryKey: ['release', d.row.id] })
      void qc.invalidateQueries({ queryKey: ['releases'] })
      void qc.invalidateQueries({ queryKey: ['letters'] })
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  if (['authorised', 'closed'].includes(d.row.status) && !issued) return null
  return (
    <>
      {!issued ? (
        <div className="grid gap-1.5">
          <Button
            variant="primary"
            size="lg"
            disabled={!d.can_authorise}
            onClick={() => setConfirming(true)}
          >
            <Gavel /> {label}
          </Button>
          {!d.can_authorise ? (
            <p className="text-[0.75rem] text-ink-3">
              Available once every condition is met. Release is never authorised automatically.
            </p>
          ) : null}
        </div>
      ) : null}
      <Dialog.Root open={confirming} onOpenChange={setConfirming}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-overlay)]">
            <Dialog.Title className="text-[1.0625rem] font-semibold text-ink">
              {label} for {d.row.reference}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-[0.875rem] text-ink-3">
              You are authorising release of {formatINR(d.row.amount_paise)} to {d.trust}. The
              letter is signed with Pramaan's key, carries a QR code anyone can verify, and{' '}
              {rtgs
                ? 'goes to the Accounts Section.'
                : 'goes to the bank with a request to discharge the lien.'}
            </Dialog.Description>
            <ul className="mt-4 grid gap-1.5 rounded-[var(--radius-panel)] bg-sunken/60 p-3">
              {d.checks.map((c) => (
                <li key={c.code} className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
                  <Check className="size-3.5 text-a2" /> {c.label}
                </li>
              ))}
            </ul>
            <label className="mt-4 block text-[0.8125rem] font-medium text-ink">
              Note for the record (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[0.875rem] font-normal focus-visible:border-accent focus-visible:outline-none"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button variant="primary" onClick={() => go.mutate()} disabled={go.isPending}>
                <Gavel />{' '}
                {go.isPending
                  ? 'Signing'
                  : rtgs
                    ? 'Sign and issue the sanction order'
                    : 'Sign and issue the NOC'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={issued !== null} onOpenChange={(o) => !o && setIssued(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-overlay)]">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-a2 text-white">
              <FileCheck2 className="size-7" />
            </span>
            <Dialog.Title className="mt-4 text-[1.125rem] font-semibold text-ink">
              {rtgs ? 'Sanction order issued' : 'NOC issued'}
            </Dialog.Title>
            <Dialog.Description className="mt-1 font-mono text-[0.875rem] text-ink-2">
              {issued?.reference}
            </Dialog.Description>
            <p className="mt-3 text-[0.8125rem] text-ink-3">
              {rtgs
                ? 'The deposit is marked released.'
                : issued?.awaiting
                  ? 'The discharge request is waiting at the bank desk. The case closes when the bank confirms.'
                  : 'The bank confirmed the discharge through the bank network. The deposit is released.'}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button asChild variant="secondary">
                <a href={`/api/v1/letters/${issued?.id}/pdf`} target="_blank" rel="noreferrer">
                  <FileText /> Open letter
                </a>
              </Button>
              <Button asChild variant="primary">
                <a href={issued?.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Verification page
                </a>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function SendDischarge({ d }: { d: ReleaseDetail }) {
  const send = useCaseMutation(
    d.row.id,
    async () =>
      unwrap(
        await api.POST('/api/v1/releases/{case_id}/discharge', {
          params: { path: { case_id: d.row.id } },
        }),
      ),
    'Discharge request sent to the bank.',
  )
  return (
    <Button variant="secondary" onClick={() => send.mutate(undefined)} disabled={send.isPending}>
      <Send /> Send discharge request to the bank
    </Button>
  )
}

function InstrumentsPanel({
  d,
  mode,
  discharging,
}: {
  d: ReleaseDetail
  mode: Mode
  discharging: boolean
}) {
  return (
    <Panel>
      <PanelHeader
        title="Deposits in this case"
        caption={
          discharging
            ? 'A discharge request is waiting at the bank desk'
            : 'The bank discharges its lien after authorisation'
        }
        actions={<SimulatedBadge />}
      />
      <div className="overflow-x-auto px-5 pb-4">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line text-left text-[0.6875rem] tracking-[0.04em] text-ink-3 uppercase">
              <th className="py-2 font-medium">Instrument</th>
              <th className="py-2 font-medium">Bank</th>
              <th className="py-2 font-medium">Matured</th>
              <th className="py-2 text-right font-medium">Amount</th>
              <th className="py-2 pl-4 font-medium">Bank discharge</th>
            </tr>
          </thead>
          <tbody>
            {d.instruments_detail.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="py-2.5 font-mono">
                  {mode === 'officer' ? (
                    <Link
                      to="/instruments/$instrumentId"
                      params={{ instrumentId: String(i.id) }}
                      className="text-ink hover:text-brand"
                    >
                      {i.number}
                    </Link>
                  ) : (
                    i.number
                  )}
                </td>
                <td className="py-2.5 text-ink-2">
                  {i.bank}, {i.branch}
                </td>
                <td className="py-2.5 text-ink-2">{formatDate(i.maturity_date)}</td>
                <td className="py-2.5 text-right">
                  <Amount paise={i.amount_paise} />
                </td>
                <td className="py-2.5 pl-4">
                  {i.released_on ? (
                    <span className="inline-flex items-center gap-1 font-medium text-a2">
                      <Landmark className="size-3.5" /> Discharged {formatDate(i.released_on)}
                    </span>
                  ) : i.discharge_status === 'sent' ? (
                    <span className="font-medium text-due">
                      Waiting at the {i.discharge_adapter === 'bank_desk' ? 'bank desk' : 'bank'}
                    </span>
                  ) : (
                    <StatusChip status={i.status} className="h-5 px-2 text-[0.6875rem]" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function LettersPanel({ d }: { d: ReleaseDetail }) {
  if (!d.letters.length) return null
  return (
    <Panel>
      <PanelHeader title="Letters" />
      <ul className="px-5 pb-4">
        {d.letters.map((l) => (
          <li key={l.id} className="border-t border-line py-3 first:border-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[0.8125rem] text-ink">{l.reference}</p>
              <Chip
                tone={l.status === 'issued' ? 'ok' : l.status === 'revoked' ? 'overdue' : 'neutral'}
              >
                {l.status === 'issued'
                  ? 'Issued'
                  : l.status === 'revoked'
                    ? 'Revoked'
                    : 'Superseded'}
              </Chip>
            </div>
            <p className="mt-0.5 text-[0.75rem] text-ink-3">
              {l.kind === 'release_sanction' ? 'Sanction order' : 'No Objection Certificate'} ·{' '}
              {formatDate(l.issued_on)}
            </p>
            <div className="mt-2 flex gap-3 text-[0.8125rem]">
              <a
                href={`/api/v1/letters/${l.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                <FileText className="size-3.5" /> Open PDF
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(l.verify_url)
                  toast.success('Verification link copied.')
                }}
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                <Copy className="size-3.5" /> Copy verify link
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function DocumentsPanel({ d }: { d: ReleaseDetail }) {
  return (
    <Panel>
      <PanelHeader title="Documents" caption="Required under Clause 6.46 a" />
      <ul className="px-5 pb-4">
        {d.documents.map((doc) => (
          <li
            key={doc.kind}
            className="flex items-center gap-3 border-t border-line py-2.5 first:border-0"
          >
            {doc.submitted ? (
              <FileCheck2 className="size-4 shrink-0 text-a2" />
            ) : (
              <FileX2 className="size-4 shrink-0 text-due" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] text-ink">{doc.label}</span>
              <span className="block truncate text-[0.6875rem] text-ink-3">
                {doc.submitted ? (doc.filename ?? 'Submitted with the application') : 'Missing'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function ComplaintsPanel({ d, mode }: { d: ReleaseDetail; mode: Mode }) {
  const [target, setTarget] = useState<number | null>(null)
  const qc = useQueryClient()
  const resolve = useMutation({
    mutationFn: async (v: { id: number; note: string }) =>
      unwrap(
        await api.POST('/api/v1/complaints/{complaint_id}/resolve', {
          params: { path: { complaint_id: v.id } },
          body: { note: v.note },
        }),
      ),
    onSuccess: () => {
      toast.success('Complaint closed.')
      setTarget(null)
      void qc.invalidateQueries({ queryKey: ['release', d.row.id] })
      void qc.invalidateQueries({ queryKey: ['clearances'] })
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  if (!d.complaints.length) return null
  const canResolve = mode === 'cell' && d.my_cell === 'pgrc'
  return (
    <Panel>
      <PanelHeader title="Grievances" caption="Complaints against the institution with PGRC" />
      <ul className="px-5 pb-4">
        {d.complaints.map((c) => (
          <li key={c.id} className="border-t border-line py-3 first:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[0.75rem] text-ink-2">{c.reference}</span>
              <Chip tone={c.status === 'open' ? 'due' : 'neutral'}>
                {c.status === 'open' ? 'Open' : 'Closed'}
              </Chip>
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-ink">{c.category}</p>
            <p className="text-[0.6875rem] text-ink-3">Opened {formatDate(c.opened_on)}</p>
            {canResolve && c.status === 'open' ? (
              <Button size="sm" className="mt-2" onClick={() => setTarget(c.id)}>
                Mark resolved
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Close this complaint"
        body="Record how the grievance was resolved. This closes it in the register and is kept in the audit trail."
        confirm="Close complaint"
        onConfirm={(note) => resolve.mutate({ id: target!, note })}
      />
    </Panel>
  )
}

function TimelinePanel({ d }: { d: ReleaseDetail }) {
  return (
    <Panel>
      <PanelHeader title="Timeline" />
      <ol className="px-5 pb-4">
        {d.events.map((e, i) => (
          <li key={i} className="relative border-l border-line pb-4 pl-4 last:pb-0">
            <span className="absolute top-1 -left-[4.5px] size-2 rounded-full bg-accent" />
            <p className="text-[0.8125rem] text-ink">{EVENT_LABEL[e.type] ?? e.type}</p>
            <p className="text-[0.6875rem] text-ink-3">
              {formatDate(e.occurred_on)}
              {e.actor ? ` · ${e.actor}` : ''}
            </p>
            {e.detail ? <p className="mt-0.5 text-[0.75rem] text-ink-2">{e.detail}</p> : null}
          </li>
        ))}
      </ol>
    </Panel>
  )
}
