import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Mail, MessageCircle, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'

import { SimulatedBadge } from '@/components/signature/chips'
import { ErrorState, Skeleton } from '@/components/ui/primitives'
import { api, unwrap } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

type Channel = 'sms' | 'whatsapp' | 'email'
type Lang = 'en' | 'hi'

const CHANNELS: { key: Channel; label: string; icon: typeof Mail }[] = [
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
]

/**
 * What the institution actually received for a reminder, on a phone: SMS and WhatsApp carry the
 * short form, email the full text, each in English or Hindi. SMS and WhatsApp are simulated.
 */
export function MessagePreview({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [lang, setLang] = useState<Lang>('hi')
  const q = useQuery({
    queryKey: ['alerts', 'preview', id],
    enabled: id !== null,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/alerts/reminders/{reminder_id}/preview', {
          params: { path: { reminder_id: id! } },
        }),
      ),
  })
  const p = q.data
  const subject = p ? (lang === 'hi' ? p.subject_hi : p.subject_en) : ''
  const body = p ? (lang === 'hi' ? p.body_hi : p.body_en) : ''
  const sent = p?.sent_on ? formatDate(p.sent_on) : 'Queued'
  return (
    <Dialog.Root open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-board/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(860px,94vw)] -translate-x-1/2 -translate-y-1/2 gap-8 rounded-[18px] border border-line bg-surface p-6 shadow-[var(--shadow-overlay)] md:grid-cols-[1fr_300px]">
          <div>
            <Dialog.Title className="font-display text-[1.875rem] leading-none text-ink">
              What the institution received
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-[0.875rem] text-ink-2">
              The same wording the scheduler sent, shown as it arrives. Email goes to{' '}
              <span className="font-mono text-[0.8125rem]">{p?.recipient ?? '...'}</span>.
            </Dialog.Description>
            <div className="mt-6 grid gap-4">
              <div role="group" aria-label="Channel" className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={channel === c.key}
                    onClick={() => setChannel(c.key)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium',
                      channel === c.key
                        ? 'border-ink bg-ink text-canvas'
                        : 'border-line-strong text-ink-2 hover:border-ink-3',
                    )}
                  >
                    <c.icon className="size-4" /> {c.label}
                  </button>
                ))}
              </div>
              <div role="group" aria-label="Language" className="flex gap-2">
                {(
                  [
                    ['hi', 'हिंदी'],
                    ['en', 'English'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={lang === k}
                    onClick={() => setLang(k)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium',
                      k === 'hi' && 'font-deva',
                      lang === k
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line-strong text-ink-2 hover:border-ink-3',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {channel !== 'email' ? (
                <p className="flex items-center gap-2 text-[0.8125rem] text-ink-3">
                  <SimulatedBadge label={`Simulated ${channel === 'sms' ? 'SMS' : 'WhatsApp'}`} />
                  No message is sent to a real phone in the prototype.
                </p>
              ) : (
                <p className="text-[0.8125rem] text-ink-3">
                  Email is really sent: to a captured inbox in the prototype, to the institution in
                  production.
                </p>
              )}
              {q.isError ? <ErrorState error={q.error} compact /> : null}
            </div>
          </div>
          <Phone>
            {!p ? (
              <div className="grid gap-3 p-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : channel === 'email' ? (
              <div className="bg-surface p-4 text-left">
                <p className="text-[0.6875rem] text-ink-3">From</p>
                <p className="text-[0.8125rem] font-medium text-ink">Pramaan, AICTE</p>
                <p className="mt-2 text-[0.6875rem] text-ink-3">Subject</p>
                <p
                  lang={lang}
                  className={cn(
                    'text-[0.875rem] font-semibold text-ink',
                    lang === 'hi' && 'font-deva',
                  )}
                >
                  {subject}
                </p>
                <p
                  lang={lang}
                  className={cn(
                    'mt-3 text-[0.8125rem] leading-relaxed text-ink-2',
                    lang === 'hi' && 'font-deva',
                  )}
                >
                  {body}
                </p>
                <p className="mt-3 text-[0.6875rem] text-ink-3">{sent}</p>
              </div>
            ) : (
              <div
                className={cn(
                  'min-h-full p-3',
                  channel === 'whatsapp' ? 'bg-[var(--wa-ground)]' : 'bg-sunken',
                )}
              >
                <p className="mb-3 text-center text-[0.6875rem] text-ink-3">
                  {channel === 'sms' ? 'AD-PRMAAN' : 'Pramaan, AICTE'} · {sent}
                </p>
                <div
                  lang={lang}
                  className={cn(
                    'max-w-[88%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink shadow-sm',
                    channel === 'whatsapp' ? 'bg-[var(--wa-bubble)]' : 'bg-surface',
                    lang === 'hi' && 'font-deva',
                  )}
                >
                  <p className="font-semibold">{subject}</p>
                  {channel === 'whatsapp' ? <p className="mt-1">{body}</p> : null}
                  <p className="mt-1.5 text-[0.6875rem] text-ink-3">pramaan.duckdns.org/portal</p>
                </div>
              </div>
            )}
          </Phone>
          <Dialog.Close
            className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[280px] rounded-[40px] border-[10px] border-device bg-device shadow-[0_40px_70px_-30px_rgb(18_23_38/0.6)]">
      <div className="flex h-[480px] flex-col overflow-hidden rounded-[30px] bg-canvas">
        <div className="flex h-7 items-center justify-between px-5 text-[0.625rem] font-medium text-ink-2">
          <span>09:41</span>
          <span className="h-4 w-16 rounded-full bg-device" aria-hidden />
          <span>5G</span>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
