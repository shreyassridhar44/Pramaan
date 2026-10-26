import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Inbox, PenLine, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Amount } from '@/components/signature/chips'
import { ProofMoment } from '@/components/security/proof-moment'
import { BankMessage } from '@/components/signature/bank-message'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { ApiError, api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate, formatRupeeText } from '@/lib/format'

export function BankDesk() {
  const [tab, setTab] = useState<'sent' | 'answered'>('sent')
  const inbox = useQuery({
    queryKey: ['bank', 'inbox', tab],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/bank/requests', { params: { query: { status: tab } } })),
    refetchInterval: 5000,
  })
  const [selected, setSelected] = useState<number | null>(null)
  const current = selected ?? inbox.data?.[0]?.id ?? null
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <Panel className="overflow-hidden">
        <div className="flex gap-1 border-b border-line p-2">
          {(['sent', 'answered'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                setSelected(null)
              }}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-[0.8125rem] font-medium',
                tab === t ? 'bg-sunken text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {t === 'sent' ? 'Waiting for answer' : 'Answered'}
            </button>
          ))}
        </div>
        {inbox.isError ? (
          <ErrorState error={inbox.error} compact />
        ) : inbox.isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : inbox.data.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={tab === 'sent' ? 'No requests waiting' : 'Nothing answered yet'}
            body="Requests from AICTE appear here when an officer asks the bank to confirm a deposit."
          />
        ) : (
          <ul>
            {inbox.data.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 border-b border-line px-4 py-3 text-left hover:bg-sunken/60',
                    r.id === current && 'bg-sunken shadow-[inset_3px_0_0_var(--simulated)]',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[0.8125rem] text-ink">{r.number}</span>
                    <span className="block truncate text-[0.75rem] text-ink-3">
                      {r.institution}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-3">
                      {r.kind === 'discharge'
                        ? 'Lien discharge'
                        : r.kind === 'reconfirm'
                          ? 'Re-confirmation'
                          : 'Confirmation'}{' '}
                      · {formatDate(r.requested_on)}
                    </span>
                  </span>
                  <Amount paise={r.amount_paise} compact className="text-[0.8125rem]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div>{current ? <DeskDetail id={current} /> : null}</div>
    </div>
  )
}

/** Amounts and dates in the comparison arrive as the bank would write them; show them readably. */
function readable(field: string, v: string | null | undefined) {
  if (v == null) return v
  if (field === 'amount') return formatRupeeText(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v)
  return v
}

function DeskDetail({ id }: { id: number }) {
  const qc = useQueryClient()
  const [signing, setSigning] = useState(false)
  const [delivered, setDelivered] = useState<{ conflicts: number } | null>(null)
  const q = useQuery({
    queryKey: ['bank', 'request', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/bank/requests/{request_id}', {
          params: { path: { request_id: id } },
        }),
      ),
  })
  const respond = useMutation({
    mutationFn: async (action: 'confirm' | 'discharge') => {
      setSigning(true)
      const [r] = await Promise.all([
        api
          .POST('/api/v1/bank/requests/{request_id}/respond', {
            params: { path: { request_id: id } },
            body: { action },
          })
          .then(unwrap),
        new Promise((res) => setTimeout(res, 1600)),
      ])
      return r
    },
    onSuccess: (r) => {
      setDelivered({ conflicts: r.conflicts.length })
      toast.success(
        r.conflicts.length
          ? 'Signed and sent. AICTE will see that your record differs from what was declared.'
          : 'Signed and sent to AICTE.',
      )
      void qc.invalidateQueries({ queryKey: ['bank'] })
    },
    onError: (e) => {
      setSigning(false)
      toast.error((e as ApiError).message)
    },
  })
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} />
      </Panel>
    )
  if (!q.data) return <Skeleton className="h-96" />
  const d = q.data
  const open = d.item.status === 'sent'
  const mismatches = d.comparison.filter((c) => !c.match).length
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader
          title={`${d.item.kind === 'discharge' ? 'Discharge the lien on' : 'Confirm deposit'} ${d.item.number}`}
          caption={`Requested by AICTE on ${formatDate(d.item.requested_on)} for ${d.item.institution}. Answer from the bank's own record.`}
        />
        <div className="px-5 pb-5">
          {!d.record_found ? (
            <p className="rounded-lg bg-overdue-soft px-4 py-3 text-[0.875rem] text-overdue">
              The bank's core system has no deposit with this number.
            </p>
          ) : null}
          <table className="mt-2 w-full text-[0.875rem]">
            <thead>
              <tr className="border-b border-line text-left text-[0.6875rem] font-medium tracking-[0.04em] text-ink-3 uppercase">
                <th className="py-2 font-medium">Field</th>
                <th className="py-2 font-medium">AICTE asks about</th>
                <th className="py-2 font-medium">Bank record</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {d.comparison.map((c) => (
                <tr
                  key={c.field}
                  className={cn(
                    'border-b border-line last:border-0',
                    !c.match && 'bg-overdue-soft/40',
                  )}
                >
                  <td className="py-2.5 text-ink-2">{c.label}</td>
                  <td className="py-2.5 font-mono text-ink">
                    {readable(c.field, c.requested) ?? 'None'}
                  </td>
                  <td
                    className={cn(
                      'py-2.5 font-mono',
                      c.match ? 'text-ink' : 'font-semibold text-overdue',
                    )}
                  >
                    {readable(c.field, c.bank_record) ?? 'Not on record'}
                  </td>
                  <td className="py-2.5 text-right">
                    {c.match ? (
                      <Check className="ml-auto size-4 text-a2" />
                    ) : (
                      <X className="ml-auto size-4 text-overdue" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {open ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-[0.8125rem] text-ink-3">
                {mismatches
                  ? `${mismatches === 1 ? '1 field in the request differs' : `${mismatches} fields in the request differ`} from the bank record. The response always carries the bank's own values.`
                  : 'The bank record agrees with the request.'}
              </p>
              <Button
                variant="primary"
                onClick={() =>
                  respond.mutate(d.item.kind === 'discharge' ? 'discharge' : 'confirm')
                }
                disabled={respond.isPending}
              >
                <PenLine />{' '}
                {d.item.kind === 'discharge'
                  ? 'Sign and confirm discharge'
                  : 'Sign and send the bank record'}
              </Button>
            </div>
          ) : null}
          <ProofMoment
            open={signing}
            done={delivered !== null}
            fields={d.comparison.map((c) => c.label)}
            keyId={d.key_id}
            bank={d.bank}
            conflicts={delivered?.conflicts ?? 0}
            onClose={() => {
              setSigning(false)
              setDelivered(null)
            }}
          />
        </div>
      </Panel>
      {d.history.map((m) => (
        <BankMessage key={m.id} message={m} bank={d.bank} simulated />
      ))}
    </div>
  )
}
