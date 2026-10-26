import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Building2,
  FileCheck2,
  Gavel,
  Landmark,
  MapPinned,
  PlayCircle,
  ScrollText,
  ShieldCheck,
  Vault,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { PLACE, SHORT } from '@/components/charts/region-layout'
import { GovFooter } from '@/components/shell/gov-footer'
import { GovStrip } from '@/components/shell/gov-strip'
import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { Microprint } from '@/components/security/print'
import { Seal, type SealTone } from '@/components/security/seal'
import { SplitFlap } from '@/components/security/split-flap'
import { RubberStamp, type StampInk } from '@/components/security/stamp'
import { PramaanMark, Wordmark } from '@/components/signature/mark'
import { Button } from '@/components/ui/button'
import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/cn'
import { formatCount, formatINRCompact, formatPercent } from '@/lib/format'
import { homeFor, useMe } from '@/lib/session'

import { usePublicSummary } from './queries'
import { tour } from '@/features/tour/store'

import { ProofSpecimen } from './specimen'
import { VerifyPanel } from './verify-panel'

type Summary = components['schemas']['PublicSummary']

/** The public face of Pramaan: what it is, live figures, how a deposit moves, and verification. */
export function HomePage() {
  const summary = usePublicSummary().data
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <GovStrip />
      <SiteHeader />
      <main id="main">
        <Hero summary={summary} />
        <Ticker summary={summary} />
        <Board summary={summary} />
        <Lifecycle />
        <Regions summary={summary} />
        <section id="verify" className="relative overflow-hidden border-y border-line bg-surface">
          <RosetteMark
            seed="verify"
            className="spin-slower absolute -bottom-64 -left-56 size-[620px] opacity-60"
          />
          <div className="relative mx-auto max-w-[1280px] px-6 py-20">
            <VerifyPanel />
          </div>
        </section>
        <Roles />
      </main>
      <GovFooter />
    </div>
  )
}

function SiteHeader() {
  const me = useMe().data
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center gap-6 px-6">
        <Link to="/home" className="flex items-center gap-3">
          <PramaanMark size={40} />
          <Wordmark sub />
        </Link>
        <nav
          aria-label="Sections"
          className="ml-6 hidden items-center gap-1 text-[0.8125rem] font-medium text-ink-2 lg:flex"
        >
          {[
            ['#board', 'Live figures'],
            ['#how', 'How it works'],
            ['#regions', 'Regions'],
            ['#verify', 'Verify a document'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-3 py-1.5 hover:bg-sunken hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {me ? (
            <Button asChild variant="primary">
              <Link to={homeFor(me.role)}>
                Open your workspace <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="primary">
              <Link to="/signin">
                Sign in <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero({ summary }: { summary?: Summary }) {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden">
      <div className="paper-grain absolute inset-0" aria-hidden />
      <RosetteMark
        seed="pramaan-hero"
        className="spin-slow absolute -top-72 -right-72 size-[980px] opacity-60"
      />
      <RosetteMark
        seed="pramaan-hero-2"
        layers={2}
        className="spin-slower absolute top-40 -left-80 size-[640px] opacity-50"
      />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24 [&>*]:min-w-0">
        <div>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 px-3 py-1 text-[0.75rem] font-medium text-ink-2"
          >
            <span className="size-1.5 rounded-full bg-a2" aria-hidden />
            Security deposit and FDR portal
            <span lang="hi" className="font-deva text-ink-3">
              सुरक्षा जमा एवं एफडीआर पोर्टल
            </span>
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
            className="mt-6 font-display text-[clamp(3rem,6.4vw,5.6rem)] leading-[0.94] tracking-[-0.02em] text-ink"
          >
            Every rupee held in trust, <em className="text-accent">proven</em> at source.
          </motion.h1>
          <p lang="hi" className="mt-4 font-deva text-[1.375rem] text-ink-3">
            विश्वास में रखा हर रुपया, स्रोत पर प्रमाणित।
          </p>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-ink-2">
            Pramaan keeps one record for every security deposit and FDR that AICTE holds. Each value
            shows where it came from: the institution, the document, or the bank. Nothing matures
            unwatched, and nothing is released without the competent authority.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link to="/signin">
                Explore the portal <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" onClick={() => tour.start()}>
              <PlayCircle /> Watch Pramaan work
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href="#verify">
                <ShieldCheck /> Verify a document
              </a>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-3 divide-x divide-line rounded-[var(--radius-panel)] border border-line bg-surface/80 backdrop-blur">
            <HeroFigure
              label="Held in trust"
              value={summary ? formatINRCompact(BigInt(summary.held_paise)) : '...'}
            />
            <HeroFigure
              label="Bank-confirmed"
              value={summary ? formatPercent(summary.bank_confirmed_share) : '...'}
              tone="text-a2"
            />
            <HeroFigure
              label="Institutions"
              value={summary ? formatCount(summary.institutions) : '...'}
            />
          </dl>
          <p className="mt-2 text-[0.6875rem] text-ink-3">
            Live from the demonstration portfolio. All data synthetic.
          </p>
        </div>
        <div data-tour="specimen">
          <ProofSpecimen />
        </div>
      </div>
      <GuillocheBand height={36} className="relative" />
    </section>
  )
}

function HeroFigure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[0.625rem] font-medium tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <dd className={cn('mt-1 font-display text-[1.875rem] leading-none text-ink', tone)}>
        <SplitFlap value={value} variant="inline" />
      </dd>
    </div>
  )
}

function tickerLines(s?: Summary): string[] {
  if (!s) return ['Loading the live portfolio']
  return [
    `${formatINRCompact(BigInt(s.held_paise))} held in trust across ${formatCount(s.held_count)} instruments`,
    `${formatPercent(s.bank_confirmed_share)} of value confirmed directly by the issuing bank`,
    `${formatCount(s.maturing_90_count)} instruments mature in the next 90 days, each with an owner and a reminder ladder`,
    `${formatCount(s.reminders_7d)} reminders sent in the last 7 days`,
    `${formatCount(s.pending_verification_count)} submissions awaiting scrutiny`,
    `${formatCount(s.open_signals)} review prompts open for an officer to check`,
    `${formatCount(s.letters_issued)} letters issued, each verifiable by QR`,
    `${formatCount(s.banks)} banks on the confirmation network (simulated)`,
  ]
}

function Ticker({ summary }: { summary?: Summary }) {
  const lines = tickerLines(summary)
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {lines.map((l, i) => (
        <li key={i} className="flex items-center gap-3 px-6 whitespace-nowrap">
          <span className="size-1.5 rotate-45 bg-saffron" aria-hidden />
          {l}
        </li>
      ))}
    </ul>
  )
  return (
    <section
      aria-label="Today on Pramaan"
      className="flex items-stretch overflow-hidden bg-board text-[0.8125rem] text-board-ink"
    >
      <p className="relative z-10 flex shrink-0 items-center gap-2 bg-accent px-4 py-2.5 font-semibold text-white">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        Live
      </p>
      <div className="flex min-w-0 flex-1 overflow-hidden py-2.5">
        <div className="ticker-track flex w-max" tabIndex={0}>
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

function Board({ summary }: { summary?: Summary }) {
  const now = useClock()
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })
  const rows: [string, string, string, string][] = summary
    ? [
        ['Held in trust', 'जमा राशि', formatINRCompact(BigInt(summary.held_paise)), 'IN TRUST'],
        ['Instruments', 'प्रपत्र', formatCount(summary.held_count), 'ACTIVE'],
        ['Bank-confirmed', 'बैंक पुष्टि', formatPercent(summary.bank_confirmed_share), 'SIGNED'],
        ['Maturing, 90 days', 'परिपक्वता', formatCount(summary.maturing_90_count), 'WATCHED'],
        [
          'Awaiting scrutiny',
          'जाँच हेतु',
          formatCount(summary.pending_verification_count),
          'IN QUEUE',
        ],
        ['Reminders, 7 days', 'अनुस्मारक', formatCount(summary.reminders_7d), 'SENT'],
        ['Letters issued', 'पत्र', formatCount(summary.letters_issued), 'QR'],
      ]
    : []
  return (
    <section id="board" className="relative mx-auto max-w-[1280px] scroll-mt-24 px-6 py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-accent uppercase">
            Portfolio board
          </p>
          <h2 className="mt-2 font-display text-[2.75rem] leading-none text-ink">
            The whole portfolio, at a glance.
          </h2>
          <p className="mt-3 max-w-2xl text-[0.9375rem] text-ink-2">
            Computed live by the same engine the officers use. Refreshes every minute.
          </p>
        </div>
        <p className="text-[0.75rem] text-ink-3">Synthetic data</p>
      </div>
      <div className="mt-8 overflow-hidden rounded-[18px] border border-black/40 bg-board p-2 shadow-[0_40px_80px_-40px_rgb(18_23_38/0.7)]">
        <div className="flex items-center justify-between gap-4 rounded-t-[12px] bg-black/30 px-5 py-3">
          <p className="flex items-center gap-3 text-[0.75rem] font-semibold tracking-[0.16em] text-board-ink/80 uppercase">
            <PramaanMark size={22} /> Pramaan, AICTE Regulation Bureau
          </p>
          <p className="flex items-center gap-2 text-[0.6875rem] text-board-ink/60">
            IST <SplitFlap value={time} className="text-[1.125rem] text-saffron" stagger={0} />
          </p>
        </div>
        <div role="table" aria-label="Portfolio board" className="divide-y divide-white/5">
          <div
            role="row"
            className="grid grid-cols-[1.4fr_1fr_auto] gap-4 px-5 py-2 text-[0.625rem] font-semibold tracking-[0.16em] text-board-ink/40 uppercase"
          >
            <span role="columnheader">Figure</span>
            <span role="columnheader" className="text-right">
              Value
            </span>
            <span role="columnheader" className="w-[7.5rem] text-right">
              State
            </span>
          </div>
          {rows.length
            ? rows.map(([en, hi, value, state]) => (
                <div
                  role="row"
                  key={en}
                  className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-4 px-5 py-2.5"
                >
                  <span
                    role="cell"
                    className="flex items-baseline gap-3 text-[0.9375rem] font-medium tracking-[0.04em] text-board-ink uppercase"
                  >
                    {en}
                    <span
                      lang="hi"
                      className="font-deva text-[0.8125rem] tracking-normal text-board-ink/45 normal-case"
                    >
                      {hi}
                    </span>
                  </span>
                  <span role="cell" className="text-right text-[1.5rem]">
                    <SplitFlap value={value} />
                  </span>
                  <span
                    role="cell"
                    className="w-[7.5rem] text-right font-mono text-[0.8125rem] tracking-[0.12em] text-saffron"
                  >
                    {state}
                  </span>
                </div>
              ))
            : Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="h-[52px] animate-pulse bg-white/[0.02]" />
              ))}
        </div>
      </div>
    </section>
  )
}

const STEPS: {
  title: string
  hi: string
  stamp: string
  sub: string
  ink: StampInk
  shape: 'rect' | 'circle'
  body: string
  who: string
}[] = [
  {
    title: 'Submitted',
    hi: 'प्रस्तुत',
    stamp: 'Received',
    sub: 'Online filing',
    ink: 'navy',
    shape: 'rect',
    body: 'The institution files the FDR details and uploads the scan. No paper, no courier.',
    who: 'Institution',
  },
  {
    title: 'Read',
    hi: 'जाँचा',
    stamp: 'Checked',
    sub: 'Scan read',
    ink: 'copper',
    shape: 'circle',
    body: 'Every field is read from the scan and compared with the declaration. A trained model marks possible alterations for an officer.',
    who: 'Pramaan',
  },
  {
    title: 'Confirmed',
    hi: 'पुष्टि',
    stamp: 'Confirmed',
    sub: 'By the bank',
    ink: 'green',
    shape: 'circle',
    body: 'The bank confirms each field in a digitally signed message. Declared and confirmed values never mix.',
    who: 'Bank',
  },
  {
    title: 'Watched',
    hi: 'निगरानी',
    stamp: 'Under watch',
    sub: 'T-90  T-60  T-30',
    ink: 'navy',
    shape: 'rect',
    body: 'Maturity and validity are watched daily. Reminders go out on a configurable ladder, by email, SMS and WhatsApp.',
    who: 'Pramaan',
  },
  {
    title: 'Escalated',
    hi: 'उन्नयन',
    stamp: 'Escalated',
    sub: 'Overdue',
    ink: 'red',
    shape: 'rect',
    body: 'Anything left unanswered climbs to the next officer on the escalation matrix, with its age and owner.',
    who: 'Regulation Bureau',
  },
  {
    title: 'Renewed',
    hi: 'नवीनीकृत',
    stamp: 'Renewed',
    sub: 'Linked to previous',
    ink: 'green',
    shape: 'rect',
    body: 'A replacement FDR is linked to the one it replaces, so the full history of every deposit stays in one chain.',
    who: 'Institution and bank',
  },
  {
    title: 'Released',
    hi: 'मुक्त',
    stamp: 'Released',
    sub: 'By authority',
    ink: 'violet',
    shape: 'circle',
    body: 'Release needs clearances from PGRC, Vigilance and Grants, then a signature from the competent authority. Never automatic.',
    who: 'Approving authority',
  },
]

function Lifecycle() {
  const reduce = useReducedMotion()
  return (
    <section
      id="how"
      className="relative scroll-mt-24 overflow-hidden border-y border-line bg-paper"
    >
      <div className="paper-grain absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-[1280px] px-6 py-20">
        <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-accent uppercase">
          How it works
        </p>
        <h2 className="mt-2 max-w-3xl font-display text-[2.75rem] leading-[1.02] text-ink">
          The life of a deposit, stamp by stamp.
        </h2>
        <p className="mt-3 max-w-2xl text-[0.9375rem] text-ink-2">
          The way an office file collects stamps as it moves from desk to desk, except every stamp
          here is a recorded event with an officer, a time and a reason.
        </p>
        <ol className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 1.8, rotate: -16 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20, delay: i * 0.12 }}
                className="flex h-[104px] items-center"
              >
                <RubberStamp
                  title={s.stamp}
                  sub={s.sub}
                  ink={s.ink}
                  shape={s.shape}
                  rotate={i % 2 ? 5 : -5}
                  className={s.shape === 'circle' ? 'h-[104px]' : 'h-[78px]'}
                />
              </motion.div>
              <p className="mt-4 font-mono text-[0.6875rem] text-ink-3">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1 flex items-baseline gap-2 text-[1.0625rem] font-semibold text-ink">
                {s.title}
                <span lang="hi" className="font-deva text-[0.8125rem] font-normal text-ink-3">
                  {s.hi}
                </span>
              </h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-2">{s.body}</p>
              <p className="mt-2 text-[0.6875rem] font-medium tracking-[0.06em] text-ink-3 uppercase">
                {s.who}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <Microprint className="relative pb-3" />
    </section>
  )
}

function Regions({ summary }: { summary?: Summary }) {
  const regions = summary?.regions ?? []
  const max = Math.max(1, ...regions.map((r) => Number(r.held_paise)))
  return (
    <section
      id="regions"
      className="mx-auto grid max-w-[1280px] scroll-mt-24 items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1.2fr]"
    >
      <div>
        <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-accent uppercase">
          Across India
        </p>
        <h2 className="mt-2 font-display text-[2.75rem] leading-[1.02] text-ink">
          Eleven AICTE regions, one record.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-ink-2">
          Each tile is a regional office. The rosette grows with the value it holds, and the green
          arc shows how much of that value the banks have confirmed. Regional officers see only
          their own region; the Bureau sees all of them.
        </p>
        <p className="mt-6 text-[0.75rem] text-ink-3">
          A cartogram, not a map: tiles are placed roughly by geography and no boundaries are drawn.
        </p>
      </div>
      <div
        className="grid grid-cols-5 gap-2"
        style={{ gridTemplateRows: 'repeat(6, minmax(78px, auto))' }}
        role="list"
        aria-label="Regions"
      >
        {regions.map((r) => {
          const place = PLACE[r.code]
          if (!place) return null
          const scale = 0.45 + 0.55 * Math.sqrt(Number(r.held_paise) / max)
          return (
            <div
              key={r.code}
              role="listitem"
              className="group relative flex flex-col justify-between overflow-hidden rounded-[12px] border border-line bg-surface p-2.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              style={{ gridColumn: place[0], gridRow: place[1] }}
            >
              <RosetteMark
                seed={r.code}
                layers={2}
                className="absolute -right-4 -bottom-4 size-[110px] transition-transform duration-500 group-hover:rotate-45"
                style={{ transform: `scale(${scale})` }}
                color="color-mix(in srgb, var(--a2) 32%, transparent)"
              />
              <p className="relative text-[0.75rem] font-semibold text-ink">
                {SHORT[r.code] ?? r.name}
              </p>
              <div className="relative">
                <p className="font-display text-[1.25rem] leading-none text-ink">
                  {formatINRCompact(BigInt(r.held_paise))}
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <div
                    className="h-full rounded-full bg-a2"
                    style={{ width: `${r.confirmed_share * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[0.625rem] text-ink-3">
                  {formatPercent(r.confirmed_share)} confirmed
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const ROLES: { title: string; hi: string; body: string; icon: LucideIcon; tone: SealTone }[] = [
  {
    title: 'Regulation Bureau',
    hi: 'विनियमन ब्यूरो',
    body: 'One command view of value held, proof and pending action, with a forecast that runs the rules forward.',
    icon: Landmark,
    tone: 'navy',
  },
  {
    title: 'Regional offices',
    hi: 'क्षेत्रीय कार्यालय',
    body: 'The same tools, scoped to the region, with its own queue and escalations.',
    icon: MapPinned,
    tone: 'navy',
  },
  {
    title: 'Institutions',
    hi: 'संस्थान',
    body: 'File, track and renew deposits online, see exactly what is due and why, and apply for release.',
    icon: Building2,
    tone: 'copper',
  },
  {
    title: 'Banks',
    hi: 'बैंक',
    body: 'Confirm deposits and discharge liens through signed messages instead of letters (simulated).',
    icon: Vault,
    tone: 'green',
  },
  {
    title: 'Clearance cells',
    hi: 'अनापत्ति प्रकोष्ठ',
    body: 'PGRC, Vigilance and Grants clear or block a release with a recorded reason.',
    icon: ScrollText,
    tone: 'muted',
  },
  {
    title: 'Competent authority',
    hi: 'सक्षम प्राधिकारी',
    body: 'Signs the release only when every condition and clearance is met. The system never decides.',
    icon: Gavel,
    tone: 'seal',
  },
]

function Roles() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-20">
      <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-accent uppercase">
        Who uses Pramaan
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-[2.75rem] leading-[1.02] text-ink">
          Everyone who touches a deposit.
        </h2>
        <Button asChild variant="primary" size="lg">
          <Link to="/signin">
            <FileCheck2 /> Try any role, no password
          </Link>
        </Button>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r) => (
          <li
            key={r.title}
            className="group relative overflow-hidden rounded-[14px] border border-line bg-surface p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-ink-3 hover:shadow-[var(--shadow-lift)]"
          >
            <Seal
              size={120}
              tone={r.tone}
              seed={r.title}
              className="absolute -top-6 -right-6 opacity-[0.12] transition-[opacity,transform] duration-500 group-hover:rotate-12 group-hover:opacity-25"
            />
            <span className="grid size-10 place-items-center rounded-xl bg-sunken text-ink-2 group-hover:bg-accent-soft group-hover:text-accent">
              <r.icon className="size-5" />
            </span>
            <h3 className="mt-4 flex items-baseline gap-2 text-[1.0625rem] font-semibold text-ink">
              {r.title}
              <span lang="hi" className="font-deva text-[0.8125rem] font-normal text-ink-3">
                {r.hi}
              </span>
            </h3>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-2">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
