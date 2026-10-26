import { Check, Vault } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { PramaanMark } from '@/components/signature/mark'
import { cn } from '@/lib/cn'

import { Seal } from './seal'

const HEX = '0123456789abcdef'
const randomHex = (n: number) =>
  Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('')

/**
 * The moment a bank's answer becomes proof. While the request is in flight the fields are
 * checked one by one and the signature digest riffles; when the response lands the signed message
 * travels to AICTE and a seal presses down. It shows what really happens (an Ed25519 signature
 * over the bank's own record); the digest characters are illustrative and labelled as such.
 */
type Props = {
  open: boolean
  done: boolean
  fields: string[]
  keyId: string
  bank: string
  conflicts: number
  onClose: () => void
}

export function ProofMoment({ open, ...props }: Props) {
  return <AnimatePresence>{open ? <ProofCard key="proof" {...props} /> : null}</AnimatePresence>
}

function ProofCard({ done, fields, keyId, bank, conflicts, onClose }: Omit<Props, 'open'>) {
  const reduce = useReducedMotion()
  const [digest, setDigest] = useState(() => randomHex(64))
  const [checked, setChecked] = useState(() => (reduce ? fields.length : 0))

  useEffect(() => {
    if (reduce) return
    const t = window.setInterval(() => setChecked((c) => Math.min(fields.length, c + 1)), 220)
    return () => window.clearInterval(t)
  }, [fields.length, reduce])

  useEffect(() => {
    if (done || reduce) return
    const t = window.setInterval(() => setDigest(randomHex(64)), 70)
    return () => window.clearInterval(t)
  }, [done, reduce])

  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(onClose, 2600)
    return () => window.clearTimeout(t)
  }, [done, onClose])

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={done ? onClose : undefined}
      className="fixed inset-0 z-[60] grid place-items-center bg-board/75 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={reduce ? false : { scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-[min(560px,100%)] overflow-hidden rounded-[18px] border border-white/10 bg-surface shadow-[0_40px_90px_-30px_rgb(0_0_0/0.7)]"
      >
        <div className="tricolour h-1" aria-hidden />
        <div className="px-6 pt-5 pb-6">
          <div className="flex items-center justify-between gap-3">
            <Node icon={<Vault className="size-5" />} title={bank} sub="Simulated bank" />
            <div className="relative mx-2 h-px flex-1 bg-line-strong">
              <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_6px,transparent_6px_10px)]" />
              {done ? (
                <motion.span
                  initial={reduce ? false : { left: '0%' }}
                  animate={{ left: '100%' }}
                  transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
                  className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md bg-a2 text-white shadow-[0_0_18px_var(--a2)]"
                >
                  <Check className="size-3.5" />
                </motion.span>
              ) : null}
            </div>
            <Node icon={<PramaanMark size={22} />} title="AICTE" sub="Pramaan" />
          </div>

          <p className="mt-6 text-[0.6875rem] font-semibold tracking-[0.12em] text-ink-3 uppercase">
            {done ? 'Signed and delivered' : 'Signing the bank record'}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {fields.map((f, i) => (
              <li key={f} className="flex items-center gap-2 text-[0.8125rem]">
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded-full border transition-colors duration-200',
                    i < checked
                      ? 'border-a2 bg-a2 text-white'
                      : 'border-line-strong text-transparent',
                  )}
                >
                  <Check className="size-2.5" />
                </span>
                <span className={i < checked ? 'text-ink' : 'text-ink-3'}>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-[var(--radius-control)] bg-board px-4 py-3 font-mono text-[0.6875rem] text-board-ink/80">
            <p className="flex justify-between gap-3 text-board-ink/70">
              <span>Ed25519</span>
              <span>key {keyId}</span>
            </p>
            <p className={cn('mt-1.5 break-all leading-relaxed', done ? 'text-a2' : 'text-accent')}>
              {digest}
            </p>
            <p className="mt-1 text-[0.5625rem] text-board-ink/35">Digest shown for illustration</p>
          </div>

          <div className="mt-5 flex min-h-[108px] items-center gap-5">
            {done ? (
              <>
                <Seal
                  size={104}
                  tone={conflicts ? 'seal' : 'green'}
                  stamp
                  seed={keyId}
                  legend={
                    conflicts
                      ? 'Bank record differs  •  Signed  •  '
                      : 'Bank-confirmed  •  Signed  •  '
                  }
                />
                <div>
                  <p className="font-display text-[1.75rem] leading-none text-ink">
                    {conflicts ? 'Signed, with differences' : 'Proof delivered'}
                  </p>
                  <p className="mt-2 text-[0.8125rem] text-ink-2">
                    {conflicts
                      ? `${conflicts} field${conflicts > 1 ? 's differ' : ' differs'} from the declaration. AICTE sees the bank's own values beside the institution's.`
                      : 'AICTE now holds the bank’s signed values beside the institution’s declaration.'}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[0.8125rem] text-ink-3">
                Waiting for the signature to be accepted
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Node({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-xl bg-sunken text-ink-2 ring-1 ring-line">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block max-w-[140px] truncate text-[0.8125rem] font-semibold text-ink">
          {title}
        </span>
        <span className="block text-[0.6875rem] text-ink-3">{sub}</span>
      </span>
    </div>
  )
}
