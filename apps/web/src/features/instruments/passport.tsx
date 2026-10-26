import { motion, useReducedMotion } from 'motion/react'

import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { Microprint } from '@/components/security/print'
import { RubberStamp, type StampInk } from '@/components/security/stamp'
import { eventDetail, eventLabel } from '@/lib/events'
import type { components } from '@/lib/api/schema'
import { formatDate } from '@/lib/format'

type Event = components['schemas']['TimelineItem']

/** Short stamp wording and ink for each kind of event; the full label sits beside it. */
function stampFor(type: string): { title: string; ink: StampInk; shape: 'rect' | 'circle' } {
  const t = type.toLowerCase()
  if (t.includes('resubmitted')) return { title: 'Resubmitted', ink: 'navy', shape: 'rect' }
  if (t.includes('submitted')) return { title: 'Received', ink: 'navy', shape: 'rect' }
  if (t.includes('document_checked')) return { title: 'Checked', ink: 'copper', shape: 'circle' }
  if (t.includes('verif')) return { title: 'Verified', ink: 'navy', shape: 'circle' }
  if (t.includes('reconfirm')) return { title: 'Re-confirmed', ink: 'green', shape: 'circle' }
  if (t.includes('bank.confirmed') || t.includes('response_received'))
    return { title: 'Bank signed', ink: 'green', shape: 'circle' }
  if (t.includes('mismatch')) return { title: 'Mismatch', ink: 'red', shape: 'circle' }
  if (t.includes('requested')) return { title: 'Asked bank', ink: 'muted', shape: 'rect' }
  if (t.includes('return') || t.includes('discrepancy'))
    return { title: 'Returned', ink: 'red', shape: 'rect' }
  if (t.includes('escalat')) return { title: 'Escalated', ink: 'red', shape: 'rect' }
  if (t.includes('renew')) return { title: 'Renewed', ink: 'green', shape: 'rect' }
  if (t.includes('release') || t.includes('discharg'))
    return { title: 'Released', ink: 'violet', shape: 'circle' }
  if (t.includes('lien_hold')) return { title: 'Lien hold', ink: 'red', shape: 'rect' }
  if (t.includes('encash')) return { title: 'Encashed', ink: 'red', shape: 'rect' }
  if (t.includes('signal')) return { title: 'Reviewed', ink: 'copper', shape: 'rect' }
  return { title: 'Recorded', ink: 'muted', shape: 'rect' }
}

/**
 * The deposit's history as a passport: every recorded event is a stamp on the page, in order,
 * with its date, the way a passport collects entry and exit stamps. The same events as the list.
 */
export function Passport({ number, events }: { number: string; events: Event[] }) {
  const reduce = useReducedMotion()
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-line-strong bg-paper shadow-[0_30px_60px_-40px_rgb(18_23_38/0.6)]">
      <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden />
      <GuillocheBand height={22} className="relative" />
      <RosetteMark
        seed={number}
        className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 opacity-60"
        color="var(--guilloche-soft)"
      />
      {/* The fold between the two pages. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 left-1/2 hidden w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-ink/[0.06] to-transparent lg:block"
      />
      <div className="relative flex items-baseline justify-between gap-4 px-7 pt-4">
        <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-ink-3 uppercase">
          Deposit passport{' '}
          <span lang="hi" className="font-deva normal-case tracking-normal">
            जमा पासपोर्ट
          </span>
        </p>
        <p className="font-mono text-[0.75rem] text-ink-2">{number}</p>
      </div>
      <ol className="relative grid grid-cols-2 gap-x-6 gap-y-8 px-7 pt-6 pb-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {events.map((e, i) => {
          const s = stampFor(e.type)
          const detail = eventDetail(e.type, e.payload)
          const rotate = ((i * 37) % 15) - 7
          return (
            <li key={i} className="flex flex-col items-center text-center">
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 1.7, rotate: rotate - 12 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 20,
                  delay: Math.min(i, 12) * 0.08,
                }}
                className="flex h-[96px] items-center"
              >
                <RubberStamp
                  title={s.title}
                  date={formatDate(e.on)}
                  ink={s.ink}
                  shape={s.shape}
                  rotate={rotate}
                  className={s.shape === 'circle' ? 'h-[92px]' : 'h-[66px]'}
                />
              </motion.div>
              <p className="mt-2 text-[0.75rem] leading-snug font-medium text-ink">
                {eventLabel(e.type)}
              </p>
              {e.actor ? <p className="text-[0.6875rem] text-ink-3">{e.actor}</p> : null}
              {detail ? (
                <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-ink-2">{detail}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
      <Microprint className="relative pb-2" />
    </div>
  )
}
