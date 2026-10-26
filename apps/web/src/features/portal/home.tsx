import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, ListTodo, Stamp } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { Microprint } from '@/components/security/print'
import { SplitFlap } from '@/components/security/split-flap'
import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { Amount, StatusChip } from '@/components/signature/chips'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  Label,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { todayIso } from '@/lib/asof'
import { cn } from '@/lib/cn'
import {
  formatCount,
  formatDate,
  formatINR,
  formatINRCompact,
  formatPercent,
  formatRelativeDays,
} from '@/lib/format'

import { usePortalHome } from './queries'
import { ResubmitDialog } from './resubmit-dialog'

const DISCIPLINE: Record<string, string> = {
  engineering_technology: 'Engineering and Technology',
  computer_applications: 'Computer Applications',
  management: 'Management',
  planning: 'Planning',
  design: 'Design',
  hmct: 'Hotel Management and Catering Technology',
  applied_arts_crafts: 'Applied Arts and Crafts',
}
const LEVEL: Record<string, string> = {
  diploma: 'Diploma',
  ug: 'Under Graduate',
  pg: 'Post Graduate',
}

type Home = NonNullable<ReturnType<typeof usePortalHome>['data']>
type Held = Home['instruments'][number]
type Demand = Home['demands'][number]

export function PortalHome() {
  const q = usePortalHome()
  const [resubmit, setResubmit] = useState<Held | null>(null)
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (q.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-44" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  const d = q.data
  const open = d.demands.filter((x) => x.status === 'open')
  return (
    <div className="grid gap-7">
      <InstitutionBand home={d} />
      {open.map((dm) => (
        <Challan key={dm.id} dm={dm} />
      ))}

      {d.tasks.length ? (
        <Panel>
          <PanelHeader title="Things to do" caption="कार्य सूची" />
          <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
            {d.tasks.map((t, i) => (
              <li
                key={t}
                className="flex items-start gap-3 rounded-[12px] border border-line bg-paper p-3 text-[0.9375rem] text-ink"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[0.75rem] font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="pt-0.5">{t}</span>
                <ListTodo className="mt-1 ml-auto size-4 shrink-0 text-ink-3" aria-hidden />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section aria-labelledby="deposits-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p lang="hi" className="font-deva text-[0.875rem] text-ink-3">
              एआईसीटीई के पास आपकी जमा राशि
            </p>
            <h2 id="deposits-heading" className="font-display text-[2rem] leading-none text-ink">
              Your deposits with AICTE
            </h2>
          </div>
          <p className="max-w-sm text-right text-[0.8125rem] text-ink-3">
            The seal shows how far each deposit is proven: read from your scan, then confirmed by
            your bank.
          </p>
        </div>
        {d.instruments.length === 0 ? (
          <Panel className="mt-4">
            <EmptyState icon={<CheckCircle2 />} title="No deposits held" />
          </Panel>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {d.instruments.map((i, n) => (
              <DepositCard key={i.id} i={i} index={n} onResubmit={() => setResubmit(i)} />
            ))}
          </ul>
        )}
      </section>
      {resubmit ? (
        <ResubmitDialog
          instrumentId={resubmit.id}
          number={resubmit.number}
          reason={resubmit.return_reason}
          onClose={() => setResubmit(null)}
        />
      ) : null}
    </div>
  )
}

/** Who the institution is and where its deposits stand, on certificate paper. */
function InstitutionBand({ home: d }: { home: Home }) {
  const held = d.instruments.reduce((a, i) => a + Number(i.amount_paise), 0)
  const proven = d.instruments
    .filter((i) => i.assurance >= 2)
    .reduce((a, i) => a + Number(i.amount_paise), 0)
  const next = [...d.instruments]
    .filter((i) => i.days_to_maturity >= 0)
    .sort((a, b) => a.days_to_maturity - b.days_to_maturity)[0]
  return (
    <section className="relative overflow-hidden rounded-[18px] border border-line-strong bg-paper shadow-[0_30px_60px_-45px_rgb(18_23_38/0.6)]">
      <div className="paper-grain absolute inset-0" aria-hidden />
      <GuillocheBand height={16} className="relative" />
      <RosetteMark
        seed={d.aicte_id}
        className="spin-slower pointer-events-none absolute -top-24 -right-16 size-[360px]"
      />
      <div className="relative grid gap-6 px-7 pt-5 pb-6 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p lang="hi" className="font-deva text-[0.9375rem] text-accent">
            नमस्ते, संस्थान पोर्टल में आपका स्वागत है
          </p>
          <h1 className="mt-1 font-display text-[2.75rem] leading-[1] text-ink">{d.institution}</h1>
          <p className="mt-2 text-[0.9375rem] text-ink-2">
            {d.trust_name} · AICTE permanent ID <span className="font-mono">{d.aicte_id}</span>
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-px self-end overflow-hidden rounded-[12px] border border-line bg-line">
          <BandFigure label="Held with AICTE" value={formatINRCompact(held)} />
          <BandFigure
            label="Proven by your bank"
            value={formatPercent(held ? proven / held : 0)}
            tone="text-a2"
          />
          <BandFigure
            label="Next maturity"
            value={next ? `${formatCount(next.days_to_maturity)} d` : 'None'}
            tone={next && next.days_to_maturity <= 90 ? 'text-due' : undefined}
          />
        </dl>
      </div>
      <Microprint className="relative pb-2" />
    </section>
  )
}

function BandFigure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-[150px] bg-surface/90 px-4 py-3">
      <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        {label}
      </dt>
      <dd className={cn('mt-1 font-display text-[1.75rem] leading-none text-ink', tone)}>
        <SplitFlap value={value} variant="inline" />
      </dd>
    </div>
  )
}

/**
 * The deposit demand as a government challan: the amount and how it was worked out on the left,
 * a tear-off counterfoil with the countdown and the penalty ladder on the right.
 */
function Challan({ dm }: { dm: Demand }) {
  const today = todayIso()
  const late = dm.days_left < 0
  return (
    <section className="relative overflow-hidden rounded-[18px] border border-line-strong bg-surface shadow-[var(--shadow-lift)]">
      <div className="grid md:grid-cols-[1fr_300px]">
        <div className="relative p-6">
          <div className="paper-grain absolute inset-0" aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            <Label>Security deposit due · सुरक्षा जमा देय</Label>
            <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[0.6875rem] text-ink-3">
              Demand {dm.id}
            </span>
          </div>
          <p className="relative mt-3 font-display text-[3.5rem] leading-none text-ink">
            {formatINR(dm.amount_paise)}
          </p>
          <p className="relative mt-2 max-w-xl text-[0.9375rem] text-ink-2">
            For your newly approved programme. Furnish it as a joint FDR in favour of AICTE, or by
            RTGS, and upload the receipt here.
          </p>
          <table className="relative mt-4 w-full text-[0.875rem]">
            <tbody>
              {dm.lines.map((l, i) => (
                <tr key={i} className="border-b border-dashed border-line-strong">
                  <td className="py-2 text-ink-2">
                    {DISCIPLINE[String(l.discipline)] ?? String(l.discipline)},{' '}
                    {LEVEL[String(l.level)] ?? String(l.level)}
                    <span className="ml-2 text-[0.75rem] text-ink-3">{String(l.note)}</span>
                  </td>
                  <td className="py-2 text-right">
                    <Amount paise={String(l.amount_paise)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="relative mt-2 text-[0.75rem] text-ink-3">Calculated under {dm.aph_ref}.</p>
        </div>
        {/* Counterfoil, separated by a perforation. */}
        <div className="relative flex flex-col justify-between border-t border-dashed border-line-strong bg-paper p-6 md:border-t-0 md:border-l">
          <span
            aria-hidden
            className="absolute -top-3 -left-3 hidden size-6 rounded-full border border-line-strong bg-canvas md:block"
          />
          <span
            aria-hidden
            className="absolute -bottom-3 -left-3 hidden size-6 rounded-full border border-line-strong bg-canvas md:block"
          />
          <div>
            <Label>{late ? 'Days late' : 'Days left'}</Label>
            <p
              className={cn(
                'mt-2 text-[2.75rem]',
                late ? 'text-overdue' : dm.days_left <= 5 ? 'text-due' : 'text-ink',
              )}
            >
              <SplitFlap value={String(Math.abs(dm.days_left)).padStart(2, '0')} />
            </p>
            <p className="mt-2 text-[0.875rem] text-ink-2">
              Due {formatDate(dm.due_on)}
              <span className="block text-[0.75rem] text-ink-3">
                {late
                  ? 'Penalty applies now'
                  : `${formatRelativeDays(dm.due_on, today)}, 15 days from intimation`}
              </span>
            </p>
            <ol className="mt-4 grid gap-0" aria-label="Penalty ladder">
              {dm.slabs.map((s, i) => (
                <li
                  key={s.until}
                  className="relative flex items-center justify-between gap-3 py-1.5 pl-5 text-[0.8125rem]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-1 size-2.5 rounded-full',
                      i === 0 ? 'bg-due' : 'bg-overdue',
                    )}
                  />
                  {i < dm.slabs.length ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 bottom-[-50%] left-[8px] w-px bg-line-strong"
                    />
                  ) : null}
                  <span className="text-ink-2">Until {formatDate(s.until)}</span>
                  <span className="font-mono text-due">{s.penalty_percent}%</span>
                </li>
              ))}
              <li className="relative py-1.5 pl-5 text-[0.8125rem] font-medium text-overdue">
                <span
                  aria-hidden
                  className="absolute left-0.5 top-1/2 size-3.5 -translate-y-1/2 rounded-sm bg-overdue"
                />
                Then approval is withdrawn
              </li>
            </ol>
          </div>
          <Button asChild variant="primary" size="lg" className="mt-5">
            <Link to="/portal/submit" search={{ demand: dm.id }}>
              <Stamp /> Submit the deposit <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function DepositCard({ i, index, onResubmit }: { i: Held; index: number; onResubmit: () => void }) {
  const reduce = useReducedMotion()
  const today = todayIso()
  const level = i.assurance as AssuranceLevel
  const soon = i.days_to_maturity >= 0 && i.days_to_maturity <= 90
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : index * 0.06 }}
      className="relative overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_1px_0_rgb(18_23_38/0.04)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <GuillocheBand
        height={10}
        color={level >= 2 ? 'color-mix(in srgb, var(--a2) 50%, transparent)' : 'var(--guilloche)'}
      />
      <RosetteMark
        seed={i.number}
        className="pointer-events-none absolute -right-10 -bottom-12 size-[200px] opacity-70"
      />
      <div className="relative flex gap-4 p-5">
        <AssuranceRing level={level} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[1rem] text-ink">{i.number}</p>
              <p className="truncate text-[0.8125rem] text-ink-3">
                {i.bank}, {i.branch}
              </p>
            </div>
            <StatusChip status={i.status} />
          </div>
          <p className="mt-3 font-display text-[1.875rem] leading-none text-ink">
            {formatINR(i.amount_paise)}
          </p>
          <p className={cn('mt-1 text-[0.8125rem]', ASSURANCE[level].text)}>
            {ASSURANCE[level].short} {ASSURANCE[level].name}
          </p>
          <p className={cn('mt-2 text-[0.8125rem]', soon ? 'font-medium text-due' : 'text-ink-2')}>
            Matures {formatDate(i.maturity_date)} ({formatRelativeDays(i.maturity_date, today)})
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">{i.next_step}</p>
          {i.return_reason ? (
            <p className="mt-2 rounded-md bg-due-soft px-2.5 py-1.5 text-[0.8125rem] text-ink">
              <span className="font-medium">AICTE:</span> {i.return_reason}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {i.status === 'returned' ? (
              <Button size="sm" variant="primary" onClick={onResubmit}>
                Correct and resubmit
              </Button>
            ) : null}
            {i.status === 'matured' ? (
              <Button asChild size="sm" variant="primary">
                <Link to="/portal/release">Apply for release</Link>
              </Button>
            ) : null}
            {i.can_renew ? (
              <Button asChild size="sm">
                <Link to="/portal/submit" search={{ renew: i.id }}>
                  Submit renewal
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.li>
  )
}
