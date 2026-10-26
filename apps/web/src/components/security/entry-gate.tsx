import { motion } from 'motion/react'

import { PramaanMark } from '@/components/signature/mark'
import { ROLE_LABEL, type Me } from '@/lib/session'

import { Rosette } from './guilloche'

/**
 * The moment of entry after sign-in: the screen turns to security paper, a rosette draws itself
 * and the officer is admitted by name and role. Shown for under a second, never under reduced
 * motion.
 */
export function EntryGate({ me }: { me: Me }) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-board text-board-ink"
    >
      <div className="tricolour absolute inset-x-0 top-0 h-1" aria-hidden />
      <Rosette
        seed={me.email}
        size={720}
        draw
        color="rgb(255 153 51 / 0.35)"
        strokeWidth={0.7}
        className="absolute"
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.45, ease: [0.2, 0, 0, 1] }}
        className="relative text-center"
      >
        <PramaanMark size={64} className="mx-auto" />
        <p lang="hi" className="mt-5 font-deva text-[1.125rem] text-board-accent">
          प्रवेश स्वीकृत
        </p>
        <p className="mt-1 font-display text-[3rem] leading-none">{me.name}</p>
        <p className="mt-2 text-[0.875rem] text-board-ink/70">
          {me.designation ?? ROLE_LABEL[me.role] ?? me.role}
        </p>
      </motion.div>
    </motion.div>
  )
}
