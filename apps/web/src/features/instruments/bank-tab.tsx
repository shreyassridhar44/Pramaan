import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Landmark, Send, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { BankMessage } from '@/components/signature/bank-message'
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

/** The animated handshake shown while a request travels to the bank and back. */
function Handshake({ stage, bank, desk }: { stage: number; bank: string; desk: boolean }) {
  const reduce = useReducedMotion()
  const labels = desk
    ? ['Request sent', `Delivered to the ${bank} desk`, 'Waiting for a bank officer to sign']
    : ['Request sent', `${bank} signs its record`, 'Signature verified']
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-sunken/40 px-6 py-5">
      <div className="relative flex items-center justify-between">
        <Node icon={<Building2 className="size-5" />} label="AICTE Pramaan" active />
        <div className="relative mx-4 h-px flex-1 bg-line-strong">
          <motion.span
            className="absolute -top-[5px] size-[11px] rounded-full bg-accent"
            animate={
              reduce
                ? undefined
                : { left: stage >= 1 ? (desk ? ['0%', '100%'] : ['0%', '100%', '0%']) : '0%' }
            }
            transition={{
              duration: 1.6,
              ease: [0.2, 0, 0, 1],
              repeat: stage < 2 && !desk ? Infinity : 0,
            }}
          />
        </div>
        <Node icon={<Landmark className="size-5" />} label={bank} active={stage >= 1} />
      </div>
      <ol className="mt-4 grid gap-1.5 sm:grid-cols-3">
        {labels.map((l, i) => (
          <li key={l} className={cn('text-[0.8125rem]', i <= stage ? 'text-ink' : 'text-ink-3')}>
            <span
              className={cn(
                'mr-2 inline-block size-1.5 rounded-full align-middle',
                i <= stage ? 'bg-a2' : 'bg-line-strong',
              )}
            />
            {l}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Node({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          'grid size-11 place-items-center rounded-full border transition-colors',
          active
            ? 'border-brand bg-brand text-brand-contrast'
            : 'border-line-strong bg-surface text-ink-3',
        )}
      >
        {icon}
      </span>
      <span className="max-w-[140px] truncate text-[0.75rem] text-ink-2">{label}</span>
    </div>
  )
}

export function BankTab({ d }: { d: Detail }) {
  const me = useMe().data
  const { isToday } = useAsOf()
  const qc = useQueryClient()
  const [stage, setStage] = useState(-1)
  const q = useQuery({
    queryKey: ['instrument', d.id, 'bank'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/instruments/{instrument_id}/bank', {
          params: { path: { instrument_id: d.id } },
        }),
      ),
  })
  const request = useMutation({
    mutationFn: async () => {
      setStage(0)
      const started = Date.now()
      const r = unwrap(
        await api.POST('/api/v1/instruments/{instrument_id}/bank/request', {
          params: { path: { instrument_id: d.id } },
          body: { kind: d.evidence.bank_confirmed_on ? 'reconfirm' : 'confirm' },
        }),
      )
      setStage(1)
      await new Promise((res) => setTimeout(res, Math.max(0, 1800 - (Date.now() - started))))
      setStage(2)
      await new Promise((res) => setTimeout(res, 700))
      return r
    },
    onSuccess: (r) => {
      if (!r.answered)
        toast.info(`Sent to ${r.request.bank}. A bank officer will answer from the bank desk.`)
      else if (r.conflicts.length)
        toast.error(
          `The bank's signed record differs on ${r.conflicts.join(', ').replaceAll('_', ' ')}.`,
        )
      else toast.success('The bank confirmed every field. Assurance raised.')
      setStage(-1)
      void qc.invalidateQueries({ queryKey: ['instrument', d.id] })
      void qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
    onError: (e) => {
      setStage(-1)
      toast.error((e as ApiError).message)
    },
  })
  const canAct = !!me && CAN_ACT.has(me.role) && isToday
  const pending = q.data?.some((r) => r.status === 'sent')
  const conflicts = d.provenance.filter((p) => p.state === 'conflict').map((p) => p.field)
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader
          title="Confirmation from the issuing bank"
          caption={`${d.bank}. ${d.bank_integration === 'network' ? 'Answers automatically through the bank network.' : 'Answered by a bank officer at the bank desk.'} Responses are signed and verified before any value is used.`}
          actions={
            canAct ? (
              <Button
                variant="primary"
                onClick={() => request.mutate()}
                disabled={request.isPending || pending}
              >
                <Send />{' '}
                {pending
                  ? 'Waiting for the bank'
                  : d.evidence.bank_confirmed_on
                    ? 'Request re-confirmation'
                    : 'Request confirmation'}
              </Button>
            ) : null
          }
        />
        <AnimatePresence>
          {stage >= 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-5"
            >
              <Handshake stage={stage} bank={d.bank} desk={d.bank_integration !== 'network'} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Panel>
      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} compact />
        </Panel>
      ) : q.isPending ? (
        <Skeleton className="h-48" />
      ) : q.data.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ShieldCheck />}
            title="No request sent to the bank yet"
            body="Request a confirmation to receive the bank's signed record of this deposit."
          />
        </Panel>
      ) : (
        q.data.map((r) => (
          <div key={r.id} className="grid gap-2">
            <p className="text-[0.75rem] text-ink-3">
              {r.kind === 'reconfirm'
                ? 'Re-confirmation'
                : r.kind === 'discharge'
                  ? 'Lien discharge'
                  : 'Confirmation'}{' '}
              requested {formatDate(r.requested_on)}
              {r.requested_by ? ` by ${r.requested_by}` : ''} via{' '}
              {r.adapter === 'bank_desk' ? 'the bank desk' : 'the bank network'} ·{' '}
              {r.status === 'sent' ? (
                <span className="font-medium text-due">waiting for the bank</span>
              ) : (
                r.status
              )}
            </p>
            {r.messages.map((m) => (
              <BankMessage
                key={m.id}
                message={m}
                bank={r.bank}
                simulated={r.simulated}
                conflicts={conflicts}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
