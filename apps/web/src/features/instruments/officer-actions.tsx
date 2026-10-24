import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertOctagon, CheckCircle2, FileText, Play, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  DocumentViewer,
  type ViewerField,
  type ViewerRegion,
} from '@/components/signature/document-viewer'
import { SeverityChip } from '@/components/signature/chips'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { ApiError, api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { useAsOf } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useMe } from '@/lib/session'

type Detail = components['schemas']['InstrumentDetail']
const CAN_ACT = new Set(['bureau_officer', 'regional_officer', 'section_head'])

function useInvalidate(id: number) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['instrument', id] })
    void qc.invalidateQueries({ queryKey: ['instruments'] })
    void qc.invalidateQueries({ queryKey: ['portfolio'] })
  }
}

/** Scrutiny actions available for the instrument's current state and the officer's role. */
export function ActionBar({ d }: { d: Detail }) {
  const me = useMe().data
  const { isToday } = useAsOf()
  const invalidate = useInvalidate(d.id)
  const [returning, setReturning] = useState(false)
  const act = useMutation({
    mutationFn: async ({
      action,
      reason,
    }: {
      action: 'start_scrutiny' | 'verify' | 'return'
      reason?: string
    }) =>
      unwrap(
        await api.POST('/api/v1/instruments/{instrument_id}/actions/{action}', {
          params: { path: { instrument_id: d.id, action } },
          body: { reason: reason ?? null, owner_id: null },
        }),
      ),
    onSuccess: (r) => {
      toast.success(r.message)
      invalidate()
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  if (!me || !CAN_ACT.has(me.role) || !isToday) return null
  const inScrutiny = ['submitted', 'under_scrutiny', 'discrepancy'].includes(d.stored_status)
  if (!inScrutiny) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {d.stored_status === 'submitted' ? (
        <Button
          size="sm"
          onClick={() => act.mutate({ action: 'start_scrutiny' })}
          disabled={act.isPending}
        >
          <Play /> Start scrutiny
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="primary"
        onClick={() => act.mutate({ action: 'verify' })}
        disabled={act.isPending}
      >
        <CheckCircle2 /> Verify
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setReturning(true)}>
        <Undo2 /> Return to institution
      </Button>
      <ReasonDialog
        open={returning}
        onOpenChange={setReturning}
        title="Return to the institution"
        body="Explain what must be corrected. The institution sees this text."
        confirm="Return"
        onConfirm={(reason) =>
          act.mutate({ action: 'return', reason }, { onSuccess: () => setReturning(false) })
        }
      />
    </div>
  )
}

function ReasonDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  body: string
  confirm: string
  onConfirm: (reason: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-overlay)]">
          <Dialog.Title className="text-[1.0625rem] font-semibold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-[0.875rem] text-ink-3">
            {body}
          </Dialog.Description>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mt-4 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[0.875rem] focus-visible:border-accent focus-visible:outline-none"
            aria-label="Reason"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              disabled={text.trim().length < 3}
              onClick={() => onConfirm(text.trim())}
            >
              {confirm}
            </Button>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 text-ink-3 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Signals with resolution: confirm the issue, dismiss with a reason, or mark resolved. */
export function SignalsPanel({ d }: { d: Detail }) {
  const me = useMe().data
  const { isToday } = useAsOf()
  const invalidate = useInvalidate(d.id)
  const [target, setTarget] = useState<{ id: number; outcome: 'confirmed' | 'dismissed' } | null>(
    null,
  )
  const resolve = useMutation({
    mutationFn: async ({
      id,
      outcome,
      note,
    }: {
      id: number
      outcome: 'confirmed' | 'dismissed'
      note: string
    }) =>
      unwrap(
        await api.POST('/api/v1/signals/{signal_id}/resolve', {
          params: { path: { signal_id: id } },
          body: { outcome, note },
        }),
      ),
    onSuccess: (r) => {
      toast.success(
        r.status === 'confirmed'
          ? 'Marked as an issue. The instrument is now a discrepancy.'
          : 'Signal dismissed with your note.',
      )
      setTarget(null)
      invalidate()
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  if (!d.signals.length) return null
  const canAct = !!me && CAN_ACT.has(me.role) && isToday
  return (
    <Panel>
      <PanelHeader
        title="Signals"
        caption="Raised by checks and models for an officer to review. They are prompts, not findings."
      />
      <ul className="px-5 pb-4">
        {d.signals.map((s) => {
          const detail = (s.evidence as { detail?: string }).detail
          return (
            <li
              key={s.id}
              className="flex items-start gap-3 border-b border-line py-3 last:border-0"
            >
              <span
                aria-hidden
                className={cn(
                  'mt-1 h-10 w-1 shrink-0 rounded-full',
                  s.severity === 'high'
                    ? 'bg-overdue'
                    : s.severity === 'medium'
                      ? 'bg-due'
                      : 'bg-line-strong',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.875rem] font-medium text-ink">{s.title}</p>
                {detail ? <p className="text-[0.8125rem] text-ink-2">{detail}</p> : null}
                <p className="mt-0.5 text-[0.75rem] text-ink-3">
                  Raised {formatDate(s.raised_on)} by {s.source} ({s.source_version}) ·{' '}
                  {s.status === 'open'
                    ? 'Open'
                    : `${s.status[0]!.toUpperCase()}${s.status.slice(1)}`}
                  {s.resolution_note ? ` · "${s.resolution_note}"` : ''}
                </p>
                {canAct && s.status === 'open' ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setTarget({ id: s.id, outcome: 'confirmed' })}
                    >
                      <AlertOctagon /> Confirm issue
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTarget({ id: s.id, outcome: 'dismissed' })}
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </div>
              <SeverityChip severity={s.severity} />
            </li>
          )
        })}
      </ul>
      <ReasonDialog
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        title={target?.outcome === 'confirmed' ? 'Confirm this issue' : 'Dismiss this signal'}
        body={
          target?.outcome === 'confirmed'
            ? 'The instrument becomes a discrepancy until resolved with the institution and the bank.'
            : 'Record why the signal does not need action. The note is kept in the audit trail.'
        }
        confirm={target?.outcome === 'confirmed' ? 'Confirm issue' : 'Dismiss'}
        onConfirm={(note) => target && resolve.mutate({ ...target, note })}
      />
    </Panel>
  )
}

/** Documents attached to the instrument, with the analysed receipt in the viewer. */
export function DocumentsTab({ d, stacked }: { d: Detail; stacked?: boolean }) {
  const scan = d.documents.find((x) => x.kind === 'fdr_scan' && x.analysed)
  const q = useQuery({
    queryKey: ['document', scan?.id],
    enabled: !!scan,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/documents/{document_id}/analysis', {
          params: { path: { document_id: scan!.id } },
        }),
      ),
  })
  if (!d.documents.length)
    return (
      <Panel>
        <EmptyState
          icon={<FileText />}
          title="No document on file"
          body="This deposit predates digital submission, or no receipt was uploaded."
        />
      </Panel>
    )
  const a = q.data as
    | {
        width: number
        height: number
        page_url: string
        heatmap_url: string
        fields: ViewerField[]
        checks: { title: string; detail: string; severity: string; field: string | null }[]
        forensics: { regions: ViewerRegion[]; method: string }
        model_versions: Record<string, string>
        duration_ms: number
      }
    | undefined
  return (
    <div className={cn('grid gap-5', !stacked && 'xl:grid-cols-12')}>
      <div className={cn(!stacked && 'xl:col-span-8')}>
        {q.isError ? (
          <Panel>
            <ErrorState error={q.error} compact />
          </Panel>
        ) : !a ? (
          <Skeleton className="h-[480px] w-full" />
        ) : (
          <DocumentViewer
            pageUrl={a.page_url}
            heatmapUrl={a.forensics.regions.length ? a.heatmap_url : undefined}
            width={a.width}
            height={a.height}
            fields={a.fields}
            regions={a.forensics.regions}
            highlight={a.checks.find((c) => c.severity === 'high')?.field ?? null}
          />
        )}
      </div>
      <div className={cn('grid content-start gap-5', stacked ? 'md:grid-cols-2' : 'xl:col-span-4')}>
        <Panel>
          <PanelHeader title="Files" />
          <ul className="px-5 pb-4 text-[0.8125rem]">
            {d.documents.map((x) => (
              <li
                key={x.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{x.filename}</span>
                  <span className="text-[0.75rem] text-ink-3">
                    {x.kind === 'fdr_scan'
                      ? 'Receipt scan'
                      : x.kind === 'affidavit_3'
                        ? 'Affidavit 3'
                        : x.kind}{' '}
                    · {formatDate(x.uploaded_on)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        {a ? (
          <Panel>
            <PanelHeader
              title="How it was read"
              caption={`${a.model_versions.ocr}; fields by ${a.model_versions.extractor}; forensics by ${a.forensics.method}; ${(a.duration_ms / 1000).toFixed(1)} s`}
            />
            <ul className="px-5 pb-4 text-[0.8125rem]">
              {a.fields.map((f) => (
                <li
                  key={f.field}
                  className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0"
                >
                  <span className="text-ink-3">{f.label}</span>
                  <span className="truncate font-mono text-ink">{f.display}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
