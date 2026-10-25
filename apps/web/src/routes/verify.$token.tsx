import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CircleHelp, KeyRound, Loader2, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { PramaanMark } from '@/components/signature/mark'
import { api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate, formatINR } from '@/lib/format'

export const Route = createFileRoute('/verify/$token')({
  component: VerifyPage,
})

const RESULT = {
  genuine: {
    en: 'Genuine',
    hi: 'प्रामाणिक',
    body: 'This letter was issued by AICTE through Pramaan and is in force.',
    icon: <ShieldCheck className="size-8" />,
    tone: 'border-a2/40 bg-a2-soft text-a2',
    solid: 'bg-a2',
  },
  superseded: {
    en: 'Superseded',
    hi: 'प्रतिस्थापित',
    body: 'This letter was genuine but has been replaced by a later letter. Rely on the later one.',
    icon: <ShieldAlert className="size-8" />,
    tone: 'border-due/40 bg-due-soft text-due',
    solid: 'bg-due',
  },
  revoked: {
    en: 'Revoked',
    hi: 'निरस्त',
    body: 'This letter was issued but has been revoked. It must not be acted upon.',
    icon: <ShieldX className="size-8" />,
    tone: 'border-overdue/40 bg-overdue-soft text-overdue',
    solid: 'bg-overdue',
  },
  not_recognised: {
    en: 'Not recognised',
    hi: 'मान्य नहीं',
    body: 'This code was not issued by Pramaan, or it has been altered. Treat the document as unverified.',
    icon: <CircleHelp className="size-8" />,
    tone: 'border-line-strong bg-sunken text-ink-2',
    solid: 'bg-ink-3',
  },
} as const

/** Public verification of a letter's QR token. No sign-in; shows only what the letter states. */
function VerifyPage() {
  const { token } = Route.useParams()
  const reduce = useReducedMotion()
  const q = useQuery({
    queryKey: ['verify', token],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/public/verify/{token}', { params: { path: { token } } })),
    retry: 1,
  })
  const r = q.data ? RESULT[q.data.result] : null
  const l = q.data?.letter
  return (
    <div className="min-h-dvh bg-canvas text-[1rem]">
      <div className="mx-auto max-w-[560px] px-4 pt-6 pb-12 sm:pt-12">
        <header className="flex items-center gap-3">
          <PramaanMark size={34} />
          <div className="leading-tight">
            <p lang="hi" className="font-deva text-[0.9375rem] text-ink-2">
              दस्तावेज़ सत्यापन
            </p>
            <h1 className="text-[1.25rem] font-semibold text-ink">Document verification</h1>
          </div>
        </header>

        {q.isPending ? (
          <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-6 text-ink-2">
            <Loader2 className="size-5 animate-spin" /> Checking the signature
          </div>
        ) : q.isError || !r ? (
          <div className="mt-8 rounded-[var(--radius-panel)] border border-line bg-surface p-6 text-ink-2">
            Verification is unavailable right now. Try again in a minute.
          </div>
        ) : (
          <>
            <motion.section
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
              className={cn('mt-8 rounded-[var(--radius-panel)] border p-6', r.tone)}
              aria-live="polite"
            >
              <div className="flex items-center gap-4">
                <motion.span
                  initial={reduce ? false : { scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.1 }}
                  className={cn('grid size-14 place-items-center rounded-full text-white', r.solid)}
                >
                  {r.icon}
                </motion.span>
                <div>
                  <p lang="hi" className="font-deva text-[1rem]">
                    {r.hi}
                  </p>
                  <p className="text-[1.75rem] leading-tight font-semibold">{r.en}</p>
                </div>
              </div>
              <p className="mt-4 text-[0.9375rem] text-ink">{r.body}</p>
              {l?.status_note ? (
                <p className="mt-2 text-[0.875rem] font-medium text-ink">{l.status_note}</p>
              ) : null}
            </motion.section>

            {l ? (
              <section className="mt-5 rounded-[var(--radius-panel)] border border-line bg-surface">
                <div className="border-b border-line px-5 py-4">
                  <p lang="hi" className="font-deva text-[0.875rem] text-ink-3">
                    {l.title_hi}
                  </p>
                  <p className="text-[1.0625rem] font-semibold text-ink">{l.title}</p>
                </div>
                <dl className="px-5 py-2">
                  <Row label="Reference" value={<span className="font-mono">{l.reference}</span>} />
                  <Row label="Institution" value={l.institution ?? 'Not stated'} />
                  <Row label="Date of issue" value={formatDate(l.issued_on)} />
                  {l.amount_paise ? <Row label="Amount" value={formatINR(l.amount_paise)} /> : null}
                  {l.instruments.length ? (
                    <Row
                      label={l.instruments.length > 1 ? 'Deposits' : 'Deposit'}
                      value={<span className="font-mono">{l.instruments.join(', ')}</span>}
                    />
                  ) : null}
                  <Row label="Issuing office" value={l.issuing_office} />
                </dl>
                <p className="border-t border-line px-5 py-3 text-[0.8125rem] text-ink-3">
                  Compare these details with the paper or PDF in front of you. Any difference means
                  the document has been altered.
                </p>
              </section>
            ) : null}

            <section className="mt-5 rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-4 text-[0.8125rem] text-ink-2">
              <p className="flex items-center gap-2 font-medium text-ink">
                <KeyRound className="size-4" /> How this check works
              </p>
              <p className="mt-1.5">
                The QR code holds a token signed with Pramaan's Ed25519 key. This page checks the
                signature against the published key{' '}
                <span className="font-mono text-[0.75rem]">{q.data.key_id}</span>, then looks up the
                letter's current state, so a revoked or replaced letter shows as such even if the
                paper copy looks perfect.
              </p>
              <p className="mt-2 text-[0.75rem] text-ink-3">
                Checked{' '}
                {new Date(q.data.checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{' '}
                IST.
              </p>
            </section>
          </>
        )}
        <p className="mt-8 text-center text-[0.75rem] text-ink-3">
          Pramaan prototype for the AICTE Regulation Bureau. Synthetic data.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-line py-2.5 last:border-0">
      <dt className="text-[0.875rem] text-ink-3">{label}</dt>
      <dd className="text-right text-[0.875rem] font-medium text-ink">{value}</dd>
    </div>
  )
}
