import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
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
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'

import { AssuranceRing } from '@/components/signature/assurance'
import { PramaanMark } from '@/components/signature/mark'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/primitives'
import { api, ApiError, unwrap } from '@/lib/api/client'
import { formatCount, formatINRCompact, formatPercent } from '@/lib/format'
import { homeFor, meQuery, type Me } from '@/lib/session'

export const Route = createFileRoute('/signin')({
  component: SignIn,
})

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
  const after = async (me: Me) => {
    qc.removeQueries()
    qc.setQueryData(meQuery.queryKey, me)
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
  const confirmedShare = summary.data?.bank_confirmed_share ?? 0

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(420px,40%)_1fr]">
      <aside className="ledger-lines relative flex flex-col justify-between border-r border-line px-10 py-10 lg:px-14">
        <div className="flex items-center gap-3">
          <PramaanMark size={34} />
          <div className="leading-tight">
            <p className="text-[0.8125rem] font-medium text-ink">
              All India Council for Technical Education
            </p>
            <p className="text-[0.75rem] text-ink-3">Regulation Bureau</p>
          </div>
        </div>

        <div className="my-16">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            className="font-display text-[4.25rem] leading-[0.95] tracking-[-0.015em] text-ink"
          >
            Pramaan
            <span lang="hi" className="ml-3 align-middle font-deva text-[1.5rem] text-ink-3">
              प्रमाण
            </span>
          </motion.h1>
          <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-ink-2">
            Security deposits and FDRs, proven at source. One record for every deposit AICTE holds,
            every value traced to the institution, the document or the bank.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line">
            <div className="bg-surface px-5 py-4">
              <Label>Held in trust</Label>
              <p className="mt-1 font-display text-[2.25rem] leading-none text-ink">
                {summary.data ? formatINRCompact(summary.data.held_paise) : '...'}
              </p>
              <p className="mt-1.5 text-[0.75rem] text-ink-3">
                {summary.data ? `${formatCount(summary.data.held_count)} instruments` : ' '}
              </p>
            </div>
            <div className="flex items-center gap-4 bg-surface px-5 py-4">
              <AssuranceRing level={2} size={44} showTip={false} animate />
              <div>
                <Label>Bank-confirmed</Label>
                <p className="mt-1 font-display text-[2.25rem] leading-none text-a2">
                  {summary.data ? formatPercent(confirmedShare) : '...'}
                </p>
                <p className="mt-1.5 text-[0.75rem] text-ink-3">of value held</p>
              </div>
            </div>
          </div>
        </div>

        <p className="max-w-md text-[0.75rem] leading-relaxed text-ink-3">
          Smart India Hackathon 2026, problem statement SIH26265. All institutions, deposits, banks
          and documents shown are synthetic. Simulated components are labelled where they appear.
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[640px]">
          <h2 className="text-xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-[0.875rem] text-ink-3">
            Use your official AICTE, institution or bank account.
          </p>
          <form
            onSubmit={submit}
            className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
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
              <div className="flex items-baseline justify-between">
                <h3 id="personas-heading" className="text-[0.9375rem] font-semibold text-ink">
                  Explore the prototype as
                </h3>
                <span className="text-[0.75rem] text-ink-3">Demo mode: one click, no password</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ordered.map((p, i) => {
                  const Icon = PERSONA_ICON[p.key] ?? UserCog
                  return (
                    <motion.button
                      key={p.key}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.04 * i, ease: [0.2, 0, 0, 1] }}
                      onClick={() => persona.mutate(p.key)}
                      disabled={persona.isPending}
                      className="group flex items-start gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-4 text-left transition-colors hover:border-ink-3 disabled:opacity-60"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2 group-hover:bg-accent-soft group-hover:text-accent">
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-[0.75rem] text-ink-3">
                          {p.designation}
                        </span>
                        <span className="mt-1 block truncate text-[0.75rem] text-ink-2">
                          {p.context}
                        </span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  )
}
