import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileCheck2, Loader2, Undo2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ApiError, api, unwrap } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/upload'
import { cn } from '@/lib/cn'

const FIELDS = [
  { key: 'amount', label: 'Amount (Rs)', type: 'text' },
  { key: 'issue_date', label: 'Issue date', type: 'date' },
  { key: 'maturity_date', label: 'Maturity date', type: 'date' },
  { key: 'ifsc', label: 'IFSC', type: 'text' },
  { key: 'holders', label: 'Holders', type: 'text' },
] as const

/** Correct a returned submission: change only what the officer asked about, optionally attach a
 * fresh scan, and explain the change. Earlier values stay in the record. */
export function ResubmitDialog({
  instrumentId,
  number,
  reason,
  onClose,
}: {
  instrumentId: number
  number: string
  reason: string | null | undefined
  onClose: () => void
}) {
  const qc = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [scan, setScan] = useState<{ document_id: number; filename: string } | null>(null)
  const upload = useMutation({
    mutationFn: (f: File) =>
      uploadDocument<{ document_id: number; filename: string }>(f, 'fdr_scan'),
    onSuccess: setScan,
    onError: (e) => toast.error((e as ApiError).message),
  })
  const send = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/portal/instruments/{instrument_id}/resubmit', {
          params: { path: { instrument_id: instrumentId } },
          body: {
            changes: Object.fromEntries(Object.entries(changes).filter(([, v]) => v.trim() !== '')),
            fdr_document_id: scan?.document_id ?? null,
            note: note.trim(),
          },
        }),
      ),
    onSuccess: () => {
      toast.success('Resubmitted to AICTE for scrutiny.')
      void qc.invalidateQueries({ queryKey: ['portal'] })
      onClose()
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  const anything = Object.values(changes).some((v) => v.trim()) || scan
  const input =
    'mt-1 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[0.9375rem] focus-visible:border-accent focus-visible:outline-none'
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[600px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-overlay)]">
          <p lang="hi" className="font-deva text-[0.875rem] text-ink-3">
            सुधार कर पुनः प्रस्तुत करें
          </p>
          <Dialog.Title className="text-[1.125rem] font-semibold text-ink">
            Correct and resubmit {number}
          </Dialog.Title>
          {reason ? (
            <div className="mt-3 rounded-[var(--radius-panel)] border border-due/40 bg-due-soft px-4 py-3 text-[0.875rem] text-ink">
              <span className="font-medium">AICTE returned this deposit:</span> {reason}
            </div>
          ) : null}
          <Dialog.Description className="mt-3 text-[0.875rem] text-ink-3">
            Fill in only the values that change. Your earlier entries stay in the record.
          </Dialog.Description>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label
                key={f.key}
                className={cn(
                  'block text-[0.8125rem] font-medium text-ink',
                  f.key === 'holders' && 'sm:col-span-2',
                )}
              >
                {f.label}
                <input
                  type={f.type}
                  value={changes[f.key] ?? ''}
                  placeholder="Unchanged"
                  onChange={(e) => setChanges((c) => ({ ...c, [f.key]: e.target.value }))}
                  className={cn(input, f.key !== 'holders' && 'font-mono')}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-line-strong px-4 py-3">
            {scan ? (
              <FileCheck2 className="size-5 text-a2" />
            ) : upload.isPending ? (
              <Loader2 className="size-5 animate-spin text-ink-3" />
            ) : (
              <Upload className="size-5 text-ink-3" />
            )}
            <span className="min-w-0 flex-1 text-[0.8125rem] text-ink-2">
              {scan
                ? `New receipt read: ${scan.filename}`
                : upload.isPending
                  ? 'Reading the receipt'
                  : 'Attach a corrected receipt (optional)'}
            </span>
            <Button size="sm" onClick={() => file.current?.click()} disabled={upload.isPending}>
              {scan ? 'Replace' : 'Choose file'}
            </Button>
            <input
              ref={file}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload.mutate(f)
                e.target.value = ''
              }}
            />
          </div>
          <label className="mt-4 block text-[0.8125rem] font-medium text-ink">
            What did you correct?
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={cn(input, 'text-[0.875rem]')}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              disabled={!anything || note.trim().length < 3 || send.isPending}
              onClick={() => send.mutate()}
            >
              <Undo2 /> Resubmit to AICTE
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
