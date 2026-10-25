import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Ban, Copy, ExternalLink, FileText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Amount, Chip } from '@/components/signature/chips'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  Input,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { ReasonDialog } from '@/features/instruments/officer-actions'
import { ApiError, api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useMe } from '@/lib/session'

type Filter = 'all' | 'issued' | 'superseded' | 'revoked'

const STATUS_TONE = { issued: 'ok', superseded: 'neutral', revoked: 'overdue' } as const

export function LettersPage() {
  const me = useMe().data
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const q = useQuery({
    queryKey: ['letters', filter],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/letters', {
          params: { query: filter === 'all' ? {} : { status: filter } },
        }),
      ),
  })
  const rows = useMemo(() => {
    const t = text.trim().toLowerCase()
    return (q.data ?? []).filter(
      (l) =>
        !t ||
        l.reference.toLowerCase().includes(t) ||
        (l.institution ?? '').toLowerCase().includes(t),
    )
  }, [q.data, text])
  const [selected, setSelected] = useState<number | null>(null)
  const current = rows.find((l) => l.id === selected) ?? rows[0]
  const [revoking, setRevoking] = useState(false)
  const revoke = useMutation({
    mutationFn: async (reason: string) =>
      unwrap(
        await api.POST('/api/v1/letters/{letter_id}/revoke', {
          params: { path: { letter_id: current!.id } },
          body: { reason },
        }),
      ),
    onSuccess: () => {
      toast.success('Letter revoked. Its QR code now verifies as revoked.')
      setRevoking(false)
      void qc.invalidateQueries({ queryKey: ['letters'] })
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  const canRevoke = me && ['approving_authority', 'section_head'].includes(me.role)

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_560px]">
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Letters"
          caption="NOCs and sanction orders issued through Pramaan. Each carries a signed QR code."
          actions={
            <div className="flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1">
              {(['all', 'issued', 'superseded', 'revoked'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-[0.8125rem] font-medium capitalize',
                    filter === f ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />
        <div className="px-5 pb-3">
          <label className="relative block max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reference or institution"
              className="pl-9"
              aria-label="Filter letters"
            />
          </label>
        </div>
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No letters"
            body="Letters appear here when the competent authority authorises a release."
          />
        ) : (
          <div className="max-h-[calc(100dvh-280px)] overflow-auto">
            <table className="w-full text-[0.8125rem]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-y border-line text-left text-[0.6875rem] tracking-[0.04em] text-ink-3 uppercase">
                  <th className="px-5 py-2.5 font-medium">Reference</th>
                  <th className="px-3 py-2.5 font-medium">Institution</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Issued</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l.id)}
                    aria-selected={l.id === current?.id}
                    className={cn(
                      'cursor-pointer border-b border-line hover:bg-sunken/50',
                      l.id === current?.id && 'bg-accent-soft/50',
                    )}
                  >
                    <td className="px-5 py-2.5">
                      <span className="block font-mono text-ink">{l.reference}</span>
                      <span className="block text-[0.6875rem] text-ink-3">{l.title}</span>
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 text-ink-2">
                      {l.institution}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {l.amount_paise ? <Amount paise={l.amount_paise} compact /> : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                      {formatDate(l.issued_on)}
                    </td>
                    <td className="px-5 py-2.5">
                      <Chip tone={STATUS_TONE[l.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                        {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {current ? (
        <Panel className="overflow-hidden xl:sticky xl:top-20 xl:self-start">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[0.875rem] text-ink">{current.reference}</p>
              <p className="text-[0.75rem] text-ink-3">
                {current.title} · issued {formatDate(current.issued_on)}
                {current.issued_by ? ` by ${current.issued_by}` : ''}
              </p>
              {current.status_note ? (
                <p
                  className={cn(
                    'mt-1 text-[0.75rem] font-medium',
                    current.status === 'revoked' ? 'text-overdue' : 'text-ink-2',
                  )}
                >
                  {current.status_note}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(current.verify_url)
                  toast.success('Verification link copied.')
                }}
              >
                <Copy /> Copy verify link
              </Button>
              <Button size="sm" asChild>
                <a href={current.verify_url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Verify
                </a>
              </Button>
              {canRevoke && current.status === 'issued' ? (
                <Button size="sm" variant="danger" onClick={() => setRevoking(true)}>
                  <Ban /> Revoke
                </Button>
              ) : null}
            </div>
          </div>
          {current.case_id && me?.role !== 'institution_user' ? (
            <p className="border-b border-line px-5 py-2 text-[0.75rem] text-ink-3">
              Release case{' '}
              <Link
                to="/releases/$caseId"
                params={{ caseId: String(current.case_id) }}
                className="font-medium text-brand hover:underline"
              >
                open case
              </Link>
            </p>
          ) : null}
          <iframe
            key={current.id}
            title={`Letter ${current.reference}`}
            src={`/api/v1/letters/${current.id}/pdf#toolbar=0&navpanes=0&view=FitH`}
            className="h-[calc(100dvh-220px)] min-h-[520px] w-full bg-sunken"
          />
        </Panel>
      ) : null}

      <ReasonDialog
        open={revoking}
        onOpenChange={setRevoking}
        title="Revoke this letter"
        body="Revocation cannot be undone. Anyone who scans the QR code will see that the letter was revoked, with this reason."
        confirm="Revoke"
        onConfirm={(reason) => revoke.mutate(reason)}
      />
    </div>
  )
}
