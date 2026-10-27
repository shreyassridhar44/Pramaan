import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Gavel,
  Landmark,
  MapPinned,
  ScrollText,
  ShieldAlert,
  UserCog,
  Vault,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'

import { GovStrip } from '@/components/shell/gov-strip'
import { EntryGate } from '@/components/security/entry-gate'
import { Foil } from '@/components/security/foil'
import { GuillocheBand, RosetteMark } from '@/components/security/guilloche'
import { Microprint } from '@/components/security/print'
import { Seal } from '@/components/security/seal'
import { SplitFlap } from '@/components/security/split-flap'
import { PramaanMark } from '@/components/signature/mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/primitives'
import { api, ApiError, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/cn'
import { formatCount, formatINRCompact, formatPercent } from '@/lib/format'
import { hashSeed } from '@/lib/guilloche'
import { homeFor, meQuery, type Me } from '@/lib/session'

export const Route = createFileRoute('/signin')({
  component: SignIn,
})

type Persona = components['schemas']['Persona']

const PERSONA_ICON: Record<string, LucideIcon> = {
  bureau: UserCog,
  section_head: ShieldAlert,
  authority: Gavel,
  regional: MapPinned,
  pgrc: ScrollText,
  vigilance: ScrollText,
  grants: ScrollText,
  institution: Building2,
  bank: Vault,
  auditor: Landmark,
  admin: UserCog,
}

/** The colour band of each identity card, by who issues it. */
const PERSONA_BAND: Record<string, { band: string; label: string }> = {
  bureau: { band: 'bg-[var(--band-navy)]', label: 'AICTE' },
  section_head: { band: 'bg-[var(--band-navy)]', label: 'AICTE' },
  authority: { band: 'bg-[var(--band-red)]', label: 'AICTE' },
  regional: { band: 'bg-[var(--band-navy)]', label: 'AICTE' },
  pgrc: { band: 'bg-[var(--band-green)]', label: 'AICTE cell' },
  institution: { band: 'bg-[var(--band-copper)]', label: 'Institution' },
  bank: { band: 'bg-[var(--band-violet)]', label: 'Bank, simulated' },
  auditor: { band: 'bg-[var(--band-grey)]', label: 'Audit' },
}

const PERSONA_ORDER = [
  'bureau',
  'section_head',
  'authority',
  'regional',
  'pgrc',
  'institution',
  'bank',
  'auditor',
]

function SignIn() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const summary = useQuery({
    queryKey: ['public-summary'],
    queryFn: async () => unwrap(await api.GET('/api/v1/public/summary')),
  })
  const personas = useQuery({
    queryKey: ['personas'],
    queryFn: async () => unwrap(await api.GET('/api/v1/auth/personas')),
  })

  // The route guards read the cached user without refetching, and a visitor usually arrives with
  // "signed out" cached, so the new session is written into the cache before navigating. Anything
  // cached under an earlier session is dropped.
  const reduce = useReducedMotion()
  const [entering, setEntering] = useState<Me | null>(null)
  const after = async (me: Me) => {
    qc.removeQueries()
    qc.setQueryData(meQuery.queryKey, me)
    if (!reduce) {
      setEntering(me)
      await new Promise((r) => setTimeout(r, 1100))
    }
    await navigate({ to: homeFor(me.role) })
  }
  const login = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/api/v1/auth/login', { body: { email, password } })),
    onSuccess: after,
  })
  const persona = useMutation({
    mutationFn: async (key: string) =>
      unwrap(await api.POST('/api/v1/auth/persona/{key}', { params: { path: { key } } })),
    onSuccess: after,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }
  const ordered = [...(personas.data ?? [])]
    .sort((a, b) => PERSONA_ORDER.indexOf(a.key) - PERSONA_ORDER.indexOf(b.key))
    .filter((p) => PERSONA_ORDER.includes(p.key))
  const s = summary.data

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {entering ? <EntryGate me={entering} /> : null}
      <GovStrip compact />
      <div className="grid flex-1 lg:grid-cols-[minmax(440px,40%)_1fr]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-board px-10 py-10 text-board-ink lg:px-14">
          <RosetteMark
            seed="signin"
            className="spin-slow absolute -right-64 -bottom-64 size-[760px]"
            color="rgb(var(--board-ink-rgb) / 0.07)"
          />
          <RosetteMark
            seed="signin-2"
            layers={2}
            className="spin-slower absolute -top-40 -left-40 size-[420px]"
            color="rgb(255 153 51 / 0.08)"
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PramaanMark size={40} />
              <div className="leading-tight">
                <p className="text-[0.8125rem] font-medium">
                  All India Council for Technical Education
                </p>
                <p className="text-[0.75rem] text-board-ink/70">Regulation Bureau</p>
              </div>
            </div>
            <Link
              to="/home"
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] text-board-ink/70 hover:bg-board-ink/10 hover:text-board-ink"
            >
              <ArrowLeft className="size-3.5" /> Home
            </Link>
          </div>

          <div className="relative my-14">
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
              className="font-display text-[4.75rem] leading-[0.92] tracking-[-0.015em]"
            >
              Pramaan
              <span
                lang="hi"
                className="ml-3 align-middle font-deva text-[1.75rem] text-board-accent"
              >
                प्रमाण
              </span>
            </motion.h1>
            <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-board-ink/75">
              Security deposits and FDRs, proven at source. One record for every deposit AICTE
              holds, every value traced to the institution, the document or the bank.
            </p>

            <div className="mt-10 max-w-md overflow-hidden rounded-[14px] border border-board-ink/10 bg-board-ink/[0.04]">
              <BoardRow label="Held in trust" value={s ? formatINRCompact(s.held_paise) : '-'} />
              <BoardRow
                label="Bank-confirmed"
                value={s ? formatPercent(s.bank_confirmed_share) : '-'}
              />
              <BoardRow label="Institutions" value={s ? formatCount(s.institutions) : '-'} />
              <p className="px-4 py-2 text-[0.625rem] tracking-[0.06em] text-board-ink/70 uppercase">
                Live, synthetic data
              </p>
            </div>
          </div>

          <div className="relative">
            <Microprint className="mb-3 text-board-ink/15" />
            <p className="max-w-md text-[0.75rem] leading-relaxed text-board-ink/70">
              All institutions, deposits, banks and documents shown are synthetic. Simulated
              components are labelled where they appear.
            </p>
          </div>
        </aside>

        <main id="main" className="relative flex items-center justify-center px-6 py-12">
          <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-[720px]">
            <h2 className="font-display text-[2.25rem] leading-none text-ink">Sign in</h2>
            <p className="mt-2 text-[0.875rem] text-ink-3">
              Use your official AICTE, institution or bank account.
            </p>
            <form
              onSubmit={submit}
              className="mt-6 grid gap-4 rounded-[14px] border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <label className="grid gap-1.5">
                <span className="text-[0.8125rem] font-medium text-ink-2">Email</span>
                <Input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[0.8125rem] font-medium text-ink-2">Password</span>
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button type="submit" variant="primary" disabled={login.isPending}>
                Sign in <ArrowRight />
              </Button>
            </form>
            {login.error ? (
              <p role="alert" className="mt-3 text-[0.8125rem] text-overdue">
                {(login.error as ApiError).message}
              </p>
            ) : null}

            {ordered.length ? (
              <section className="mt-12" aria-labelledby="personas-heading">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 id="personas-heading" className="text-[0.9375rem] font-semibold text-ink">
                    Explore Pramaan as
                  </h3>
                  <span className="text-[0.75rem] text-ink-3">
                    Demo mode: one click, no password
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ordered.map((p, i) => (
                    <IdCard
                      key={p.key}
                      persona={p}
                      index={i}
                      busy={persona.isPending}
                      chosen={
                        persona.variables === p.key && (persona.isPending || persona.isSuccess)
                      }
                      onChoose={() => persona.mutate(p.key)}
                    />
                  ))}
                </div>
                {persona.error ? (
                  <p role="alert" className="mt-3 text-[0.8125rem] text-overdue">
                    {(persona.error as ApiError).message}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function BoardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-board-ink/5 px-4 py-3">
      <span className="text-[0.75rem] font-medium tracking-[0.1em] text-board-ink/70 uppercase">
        {label}
      </span>
      <span className="text-[1.375rem]">
        <SplitFlap value={value} />
      </span>
    </div>
  )
}

function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
}

/**
 * A persona as an identity card: issuer band, guilloche ground, a hologram that catches the
 * pointer, and an "Admitted" seal that presses down while the session starts.
 */
function IdCard({
  persona: p,
  index,
  busy,
  chosen,
  onChoose,
}: {
  persona: Persona
  index: number
  busy: boolean
  chosen: boolean
  onChoose: () => void
}) {
  const reduce = useReducedMotion()
  const Icon = PERSONA_ICON[p.key] ?? UserCog
  const band = PERSONA_BAND[p.key] ?? { band: 'bg-[var(--band-grey)]', label: 'AICTE' }
  const idNo = `PRM-${(hashSeed(p.key) % 90000) + 10000}`
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 * index, ease: [0.2, 0, 0, 1] }}
    >
      <Foil intensity={0.55} className="rounded-[14px]">
        <button
          type="button"
          onClick={onChoose}
          disabled={busy}
          className="group relative flex w-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface text-left shadow-[0_1px_0_rgb(18_23_38/0.04)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink-3 hover:shadow-[var(--shadow-lift)] disabled:cursor-wait"
        >
          <span className={cn('relative flex h-7 items-center justify-between px-3', band.band)}>
            <GuillocheBand height={28} color="rgb(0 0 0 / 0.22)" className="absolute inset-0" />
            <span className="relative text-[0.5625rem] font-semibold tracking-[0.16em] text-white uppercase">
              {band.label}
            </span>
            <span className="relative font-mono text-[0.5625rem] tracking-[0.08em] text-white">
              {idNo}
            </span>
          </span>
          <span className="relative flex items-start gap-3 p-3.5">
            <RosetteMark
              seed={p.key}
              layers={2}
              className="absolute -right-6 -bottom-8 size-[120px] opacity-70"
            />
            <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-sunken text-[0.9375rem] font-semibold text-ink-2 ring-1 ring-line-strong group-hover:bg-accent-soft group-hover:text-accent">
              {initials(p.name)}
              <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-surface ring-1 ring-line">
                <Icon className="size-3 text-ink-3" />
              </span>
            </span>
            <span className="relative min-w-0">
              <span className="block text-[0.9375rem] font-semibold text-ink">{p.name}</span>
              <span className="block truncate text-[0.75rem] text-ink-3">{p.designation}</span>
              <span className="mt-1 block truncate text-[0.75rem] text-ink-2">{p.context}</span>
            </span>
            <span
              aria-hidden
              className="relative ml-auto size-6 shrink-0 rounded-full opacity-80"
              style={{
                background:
                  'conic-gradient(from 40deg, #ffd6e0, #fff1c2, #d4f7c9, #c6efff, #e1d6ff, #ffd6e0)',
              }}
            />
          </span>
          {chosen ? (
            <span
              className="pointer-events-none absolute inset-0 grid place-items-center bg-surface/40"
              aria-hidden
            >
              <Seal
                size={96}
                tone="green"
                stamp
                mark="tick"
                seed={p.key}
                legend="Admitted  •  प्रवेश  •  "
              />
            </span>
          ) : null}
        </button>
      </Foil>
    </motion.div>
  )
}
