import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Check,
  CircleDashed,
  FileCheck2,
  FileUp,
  FlaskConical,
  Loader2,
  Send,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Amount } from '@/components/signature/chips'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { CaseChip, ClearanceDots } from '@/features/releases/release-list'
import { ApiError, api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { specimenFile, uploadDocument } from '@/lib/api/upload'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useMe } from '@/lib/session'

const SPECIMEN: Record<string, string> = {
  application_letter: 'application_letter',
  affidavit_6: 'affidavit_6',
  instrument_copy: 'genuine',
  latest_loa_eoa: 'latest_loa_eoa',
}

type Uploaded = { document_id: number; filename: string }

export function PortalReleases() {
  const q = useQuery({
    queryKey: ['portal', 'releases'],
    queryFn: async () => unwrap(await api.GET('/api/v1/portal/releases')),
  })
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (!q.data) return <Skeleton className="h-[520px]" />
  const d = q.data
  return (
    <div className="grid gap-6">
      <div>
        <p lang="hi" className="font-deva text-[0.9375rem] text-ink-3">
          सुरक्षा जमा राशि की वापसी
        </p>
        <h1 className="text-[1.5rem] font-semibold text-ink">Release of security deposit</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] text-ink-2">
          A deposit can be released after it completes its term, once PGRC, the Vigilance Cell and
          the Grants bureaus have no objection (APH 2024-27 Clause 6.46).
        </p>
      </div>
      {d.cases.length ? (
        <Panel>
          <PanelHeader title="Your applications" />
          <ul className="px-5 pb-3">
            {d.cases.map((c) => (
              <li key={c.id} className="border-t border-line first:border-0">
                <Link
                  to="/portal/release"
                  search={{ case: c.id }}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 hover:text-brand"
                >
                  <span className="min-w-[180px]">
                    <span className="block font-mono text-[0.875rem] text-ink">{c.reference}</span>
                    <span className="block text-[0.75rem] text-ink-3">
                      Applied {formatDate(c.applied_on)}
                    </span>
                  </span>
                  <Amount paise={c.amount_paise} />
                  <ClearanceDots clearances={c.clearances} />
                  <span className="ml-auto">
                    <CaseChip row={c} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <ApplyForm data={d} />
    </div>
  )
}

type Data = components['schemas']['PortalReleases']

function ApplyForm({ data }: { data: Data }) {
  const me = useMe().data
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState<number[]>([])
  const [docs, setDocs] = useState<Record<string, Uploaded>>({})
  const [accepted, setAccepted] = useState(false)
  const documentIds = Object.values(docs).map((x) => x.document_id)
  const preview = useQuery({
    queryKey: ['portal', 'release-preview', chosen, documentIds],
    enabled: chosen.length > 0,
    queryFn: async () =>
      unwrap(
        await api.POST('/api/v1/portal/releases/preview', {
          body: { instrument_ids: chosen, document_ids: documentIds, declaration_accepted: false },
        }),
      ),
  })
  const apply = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/portal/releases', {
          body: {
            instrument_ids: chosen,
            document_ids: documentIds,
            declaration_accepted: accepted,
          },
        }),
      ),
    onSuccess: (r) => {
      toast.success(`Application ${r.reference} sent to AICTE.`)
      qc.removeQueries({ queryKey: ['portal', 'release-preview'] })
      void qc.invalidateQueries({ queryKey: ['portal', 'releases'] })
      void qc.invalidateQueries({ queryKey: ['portal', 'home'] })
      void navigate({ to: '/portal/release', search: { case: r.case_id } })
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  const eligible = data.instruments.filter((i) => i.can_apply)
  const allDocs = data.required_documents.every((r) => docs[r.kind])
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Panel>
        <PanelHeader
          title="Apply for release"
          caption="Choose the deposit, attach the four documents, and see what remains before AICTE can decide"
        />
        <div className="grid gap-6 px-5 pb-5">
          <section>
            <p className="mb-2 text-[0.875rem] font-medium text-ink">1. Deposit</p>
            {data.instruments.length === 0 ? (
              <EmptyState
                icon={<CircleDashed />}
                title="No deposit to release"
                body="Deposits appear here once AICTE holds them for your institution."
              />
            ) : (
              <ul className="grid gap-2">
                {data.instruments.map((i) => {
                  const on = chosen.includes(i.id)
                  return (
                    <li key={i.id}>
                      <label
                        className={cn(
                          'flex items-center gap-3 rounded-[var(--radius-panel)] border px-4 py-3',
                          i.can_apply ? 'cursor-pointer hover:border-ink-3' : 'opacity-60',
                          on ? 'border-accent bg-accent-soft/40' : 'border-line',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--accent)]"
                          disabled={!i.can_apply}
                          checked={on}
                          onChange={() =>
                            setChosen((c) => (on ? c.filter((x) => x !== i.id) : [...c, i.id]))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-[0.875rem] text-ink">
                            {i.number}
                          </span>
                          <span className="block text-[0.75rem] text-ink-3">
                            {i.bank} · {i.can_apply ? 'matured' : 'matures'}{' '}
                            {formatDate(i.maturity_date)}
                          </span>
                          {i.reason ? (
                            <span className="block text-[0.75rem] text-due">{i.reason}</span>
                          ) : null}
                        </span>
                        <Amount paise={i.amount_paise} />
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {data.instruments.length > 0 && eligible.length === 0 ? (
              <p className="mt-2 text-[0.8125rem] text-ink-3">
                None of your deposits has completed its term yet.
              </p>
            ) : null}
          </section>

          <section>
            <p className="mb-2 text-[0.875rem] font-medium text-ink">2. Documents</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.required_documents.map((r) => (
                <li key={r.kind}>
                  <DocSlot
                    kind={r.kind}
                    label={r.label}
                    value={docs[r.kind]}
                    demo={!!me?.demo_mode}
                    onDone={(u) => setDocs((d) => ({ ...d, [r.kind]: u }))}
                    onClear={() =>
                      setDocs((d) => {
                        const next = { ...d }
                        delete next[r.kind]
                        return next
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="mb-2 text-[0.875rem] font-medium text-ink">3. Declaration</p>
            <label className="flex items-start gap-3 text-[0.875rem] text-ink-2">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--accent)]"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              The documents are true copies, and no grievance, proceeding or unutilised grant
              against the institution has been withheld from AICTE.
            </label>
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
            {!allDocs && chosen.length ? (
              <p className="text-[0.8125rem] text-ink-3">
                You can apply now; missing documents keep the case pending.
              </p>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              disabled={!chosen.length || !accepted || apply.isPending}
              onClick={() => apply.mutate()}
            >
              {apply.isPending ? <Loader2 className="animate-spin" /> : <Send />} Send application
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="self-start lg:sticky lg:top-6">
        <PanelHeader
          title="What AICTE will check"
          caption="Updates as you choose a deposit and attach documents"
        />
        <div className="px-5 pb-5">
          {!chosen.length ? (
            <p className="text-[0.8125rem] text-ink-3">Choose a deposit to see the checklist.</p>
          ) : preview.isPending ? (
            <div className="grid gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : preview.isError ? (
            <ErrorState error={preview.error} compact />
          ) : (
            <ul className="grid gap-2.5">
              {preview.data.checks.map((c) => (
                <li key={c.code} className="flex items-start gap-2.5">
                  {c.state === 'pass' ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-a2" />
                  ) : c.state === 'fail' ? (
                    <X className="mt-0.5 size-4 shrink-0 text-overdue" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-due" />
                  )}
                  <span>
                    <span className="block text-[0.8125rem] text-ink">{c.label}</span>
                    <span className="block text-[0.75rem] text-ink-3">{c.detail}</span>
                  </span>
                </li>
              ))}
              <li className="mt-1 border-t border-line pt-3 text-[0.75rem] text-ink-3">
                Decided by: {preview.data.authority}
              </li>
            </ul>
          )}
        </div>
      </Panel>
    </div>
  )
}

function DocSlot({
  kind,
  label,
  value,
  demo,
  onDone,
  onClear,
}: {
  kind: string
  label: string
  value?: Uploaded
  demo: boolean
  onDone: (u: Uploaded) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const up = useMutation({
    mutationFn: (file: File) => uploadDocument<Uploaded>(file, kind),
    onSuccess: onDone,
    onError: (e) => toast.error((e as ApiError).message),
  })
  const specimen = useMutation({
    mutationFn: async () => uploadDocument<Uploaded>(await specimenFile(SPECIMEN[kind]!), kind),
    onSuccess: onDone,
    onError: (e) => toast.error((e as ApiError).message),
  })
  const busy = up.isPending || specimen.isPending
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-[var(--radius-panel)] border px-4 py-3',
        value ? 'border-a2/40 bg-a2-soft/30' : 'border-dashed border-line-strong',
      )}
    >
      <div className="flex items-start gap-2.5">
        {value ? (
          <FileCheck2 className="mt-0.5 size-4 shrink-0 text-a2" />
        ) : busy ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-ink-3" />
        ) : (
          <FileUp className="mt-0.5 size-4 shrink-0 text-ink-3" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-medium text-ink">{label}</span>
          <span className="block truncate text-[0.75rem] text-ink-3">
            {value ? value.filename : 'PDF, JPG or PNG up to 10 MB'}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {value ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Replace
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
              Choose file
            </Button>
            {demo ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => specimen.mutate()}
                disabled={busy}
                title="Synthetic specimen for the demo"
              >
                <FlaskConical /> Use specimen
              </Button>
            ) : null}
          </>
        )}
        <input
          ref={input}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) up.mutate(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
