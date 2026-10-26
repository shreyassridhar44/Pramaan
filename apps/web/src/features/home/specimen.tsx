import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { Foil } from '@/components/security/foil'
import { GuillocheBand, Rosette, RosetteMark } from '@/components/security/guilloche'
import { Microprint, SecurityThread } from '@/components/security/print'
import { Seal } from '@/components/security/seal'
import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import { cn } from '@/lib/cn'

const STEP_MS = 3200
const NUMBER = '6422 6103 4588 12'

const STAGE: Record<AssuranceLevel, { feature: string; evidence: string }> = {
  0: { feature: 'Plain paper', evidence: 'The institution typed these values. Nothing independent yet.' },
  1: {
    feature: 'Watermark',
    evidence: 'The uploaded scan was read field by field and the values agree.',
  },
  2: {
    feature: 'Guilloche and seal',
    evidence: 'The issuing bank confirmed every field in a signed message.',
  },
  3: {
    feature: 'Holographic foil',
    evidence: 'The bank confirmed it again within the last year.',
  },
}

/**
 * A specimen deposit receipt that earns security features as its proof grows: plain paper when
 * declared, a watermark once the document is read, guilloche and a seal when the bank confirms,
 * foil when it is re-confirmed. It plays through once, then follows the visitor's choice.
 */
export function ProofSpecimen() {
  const reduce = useReducedMotion()
  const [level, setLevel] = useState<AssuranceLevel>(reduce ? 3 : 0)
  const [auto, setAuto] = useState(!reduce)

  useEffect(() => {
    if (!auto) return
    const t = window.setTimeout(() => {
      if (level === 3) setAuto(false)
      else setLevel((l) => (l + 1) as AssuranceLevel)
    }, STEP_MS)
    return () => window.clearTimeout(t)
  }, [auto, level])

  const meta = ASSURANCE[level]
  return (
    <figure className="relative">
      <Foil
        tilt
        always
        intensity={level === 3 ? 1 : 0}
        className="overflow-hidden rounded-[14px] border border-line-strong bg-paper shadow-[0_40px_80px_-40px_rgb(18_23_38/0.55),0_2px_0_rgb(255_255_255/0.6)_inset]"
      >
        <div className="paper-grain absolute inset-0" aria-hidden />
        <GuillocheBand
          height={30}
          color={level >= 2 ? 'color-mix(in srgb, var(--a2) 55%, transparent)' : 'var(--guilloche-soft)'}
          className="transition-colors duration-700"
        />

        {/* Watermark: appears once the document has been read. */}
        <AnimatePresence>
          {level >= 1 ? (
            <motion.div
              key="wm"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
              aria-hidden
            >
              <RosetteMark seed={NUMBER} className="size-[300px] opacity-70" color="var(--guilloche-soft)" />
              <span
                lang="hi"
                className="absolute font-deva text-[5.5rem] font-semibold text-[color:var(--guilloche-soft)]"
              >
                प्रमाण
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {level >= 3 ? (
          <div className="absolute top-0 bottom-0 left-3 flex w-2 items-stretch" aria-hidden>
            <SecurityThread className="w-1.5" />
          </div>
        ) : null}

        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] font-display text-[4.5rem] tracking-[0.3em] text-overdue/[0.07] uppercase select-none"
        >
          Specimen
        </span>
        <div className="relative grid grid-cols-[1fr_auto] gap-6 px-7 pt-5 pb-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-ink-3 uppercase">
              Bharat National Bank
              <span className="rounded-full bg-simulated-soft px-1.5 py-px text-[0.5625rem] tracking-[0.06em] text-simulated normal-case">
                Simulated bank
              </span>
            </p>
            <p className="mt-1 font-display text-[1.75rem] leading-none text-ink">Fixed Deposit Receipt</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3.5">
              <Field label="Receipt no." value={NUMBER} mono read={level >= 1} delay={0} wide />
              <Field label="Amount" value="₹15,00,000" mono read={level >= 1} delay={0.15} big />
              <Field label="Under lien to" value="AICTE Regulation Bureau" read={level >= 1} delay={0.3} />
              <Field label="Issued" value="20 Oct 2026" mono read={level >= 1} delay={0.45} />
              <Field label="Matures" value="20 Oct 2036" mono read={level >= 1} delay={0.6} />
            </dl>
          </div>
          <div className="relative flex w-[150px] flex-col items-center justify-start pt-1">
            <div className="relative grid size-[132px] place-items-center">
              {level >= 2 ? (
                <Rosette seed={NUMBER} size={132} color="color-mix(in srgb, var(--a2) 70%, transparent)" draw className="absolute" />
              ) : (
                <span className="absolute inset-2 rounded-full border border-dashed border-line-strong" aria-hidden />
              )}
              <AnimatePresence>
                {level >= 2 ? (
                  <motion.div
                    key="seal"
                    className="absolute"
                    initial={reduce ? false : { scale: 1.9, rotate: -24, opacity: 0 }}
                    animate={{ scale: 1, rotate: -9, opacity: 1 }}
                    transition={{ delay: 0.9, type: 'spring', stiffness: 380, damping: 18 }}
                  >
                    <Seal size={92} tone="green" seed={NUMBER} legend="Bank-confirmed  •  Signed message  •  " />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            {level >= 3 ? (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="foil-chip mt-2 rounded-md px-2 py-1 text-center text-[0.625rem] font-semibold tracking-[0.08em] text-ink uppercase"
                style={{
                  background:
                    'linear-gradient(115deg, #ffd6e0, #fff1c2 25%, #d4f7c9 45%, #c6efff 65%, #e1d6ff 85%)',
                }}
              >
                Re-confirmed 2027
              </motion.div>
            ) : null}
          </div>
        </div>
        <div className="relative border-t border-line/70 px-7 py-2">
          {level >= 2 ? (
            <p className="font-mono text-[0.6875rem] text-a2">
              Ed25519 signature valid, key bank-sbx-03
            </p>
          ) : (
            <p className="font-mono text-[0.6875rem] text-ink-3">No bank signature yet</p>
          )}
          <Microprint className="mt-1" />
        </div>
      </Foil>

      <figcaption className="mt-5">
        <ol className="grid grid-cols-4 gap-2" aria-label="Assurance levels">
          {([0, 1, 2, 3] as AssuranceLevel[]).map((l) => (
            <li key={l}>
              <button
                type="button"
                aria-pressed={level === l}
                onClick={() => {
                  setAuto(false)
                  setLevel(l)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-2 text-left transition-colors',
                  level === l ? 'border-ink bg-surface shadow-[var(--shadow-lift)]' : 'border-line hover:border-ink-3',
                )}
              >
                <AssuranceRing level={l} size={20} showTip={false} />
                <span className="min-w-0">
                  <span className="block text-[0.6875rem] font-semibold text-ink">{ASSURANCE[l].short}</span>
                  <span className="block truncate text-[0.6875rem] text-ink-3">{ASSURANCE[l].name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 min-h-[2.5rem] text-[0.8125rem] text-ink-2" aria-live="polite">
          <span className={cn('font-semibold', meta.text)}>
            {meta.short} {meta.name}: {STAGE[level].feature}.
          </span>{' '}
          {STAGE[level].evidence}
        </p>
      </figcaption>
    </figure>
  )
}

function Field({
  label,
  value,
  mono,
  read,
  delay,
  big,
  wide,
}: {
  label: string
  value: string
  mono?: boolean
  read: boolean
  delay: number
  big?: boolean
  wide?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('relative', wide && 'col-span-2')}>
      <dt className="text-[0.625rem] font-medium tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <dd className={cn('mt-0.5 text-ink', mono && 'font-mono tabular', big ? 'text-[1.25rem] font-semibold' : 'text-[0.875rem]')}>
        {value}
      </dd>
      <AnimatePresence>
        {read ? (
          <motion.span
            aria-hidden
            initial={reduce ? false : { opacity: 0, scale: 1.08 }}
            animate={{ opacity: [0, 1, 1, 0.0], scale: 1 }}
            transition={{ duration: 2.2, delay, times: [0, 0.15, 0.7, 1] }}
            className="pointer-events-none absolute -inset-x-1.5 -inset-y-1 rounded border border-dashed border-a1 bg-a1/5"
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
