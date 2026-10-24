import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react'

import { AssuranceRing } from '@/components/signature/assurance'
import { type AssuranceLevel } from '@/components/signature/assurance-meta'
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
import { formatDate, formatINR, formatRelativeDays } from '@/lib/format'

import { usePortalHome } from './queries'

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

export function PortalHome() {
  const q = usePortalHome()
  const today = todayIso()
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (q.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-56" />
        <Skeleton className="h-64" />
      </div>
    )
  const d = q.data
  const open = d.demands.filter((x) => x.status === 'open')
  return (
    <div className="grid gap-6">
      <div>
        <p lang="hi" className="font-deva text-[0.9375rem] text-ink-3">
          नमस्ते, संस्थान पोर्टल
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink">
          {d.institution}
        </h1>
        <p className="mt-1 text-[0.9375rem] text-ink-2">
          {d.trust_name} · AICTE ID <span className="font-mono">{d.aicte_id}</span>
        </p>
      </div>

      {open.map((dm) => {
        const late = dm.days_left < 0
        return (
          <Panel key={dm.id} className="overflow-hidden">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
              <div>
                <Label>Security deposit due</Label>
                <p className="mt-2 font-display text-[3rem] leading-none text-ink">
                  {formatINR(dm.amount_paise)}
                </p>
                <p className="mt-2 text-[0.9375rem] text-ink-2">
                  For your newly approved programme. Furnish it as a joint FDR in favour of AICTE,
                  or by RTGS, and upload the receipt here.
                </p>
                <ul className="mt-4 grid gap-1.5 text-[0.875rem]">
                  {dm.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-4 border-b border-line pb-1.5">
                      <span className="text-ink-2">
                        {DISCIPLINE[String(l.discipline)] ?? String(l.discipline)},{' '}
                        {LEVEL[String(l.level)] ?? String(l.level)}
                        <span className="ml-2 text-[0.75rem] text-ink-3">{String(l.note)}</span>
                      </span>
                      <Amount paise={String(l.amount_paise)} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[0.75rem] text-ink-3">Calculated under {dm.aph_ref}.</p>
              </div>
              <div className="flex min-w-[260px] flex-col justify-between rounded-[var(--radius-panel)] border border-line bg-sunken/50 p-5">
                <div>
                  <Label>Deadline</Label>
                  <p
                    className={cn(
                      'mt-1 text-[1.5rem] font-semibold',
                      late ? 'text-overdue' : dm.days_left <= 5 ? 'text-due' : 'text-ink',
                    )}
                  >
                    {formatDate(dm.due_on)}
                  </p>
                  <p className="text-[0.875rem] text-ink-2">
                    <CalendarClock className="mr-1 inline size-4 align-[-3px]" />
                    {late
                      ? `${-dm.days_left} days late`
                      : `${formatRelativeDays(dm.due_on, today)}, 15 days from intimation`}
                  </p>
                  <ol className="mt-4 grid gap-1.5 border-t border-line pt-3 text-[0.8125rem] text-ink-3">
                    {dm.slabs.map((s) => (
                      <li key={s.until} className="flex justify-between gap-3">
                        <span>Late, up to {formatDate(s.until)}</span>
                        <span className="font-mono text-due">{s.penalty_percent}% penalty</span>
                      </li>
                    ))}
                    <li className="text-overdue">After that, the approval is withdrawn.</li>
                  </ol>
                </div>
                <Button asChild variant="primary" size="lg" className="mt-5">
                  <Link to="/portal/submit" search={{ demand: dm.id }}>
                    Submit the deposit <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </Panel>
        )
      })}

      {d.tasks.length ? (
        <Panel>
          <PanelHeader title="Things to do" caption="कार्य सूची" />
          <ul className="px-5 pb-4">
            {d.tasks.map((t) => (
              <li
                key={t}
                className="flex items-start gap-3 border-b border-line py-2.5 text-[0.9375rem] text-ink last:border-0"
              >
                <ListTodo className="mt-0.5 size-4 shrink-0 text-accent" /> {t}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Your deposits with AICTE"
          caption="एआईसीटीई के पास जमा राशि. The proof ring shows how far each deposit has been confirmed."
        />
        {d.instruments.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />} title="No deposits held" />
        ) : (
          <ul className="px-5 pb-3">
            {d.instruments.map((i) => (
              <li
                key={i.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line py-3.5 last:border-0"
              >
                <AssuranceRing level={i.assurance as AssuranceLevel} size={34} />
                <div className="min-w-0">
                  <p className="font-mono text-[0.9375rem] text-ink">{i.number}</p>
                  <p className="text-[0.8125rem] text-ink-3">
                    {i.bank} · matures {formatDate(i.maturity_date)} (
                    {formatRelativeDays(i.maturity_date, today)})
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-2">{i.next_step}</p>
                </div>
                <div className="text-right">
                  <Amount paise={i.amount_paise} className="text-[0.9375rem]" />
                  <div className="mt-1">
                    <StatusChip status={i.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
