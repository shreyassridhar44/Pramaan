import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { GuillocheBand } from '@/components/security/guilloche'
import { api, unwrap } from '@/lib/api/client'
import { meQuery } from '@/lib/session'

import { STEPS } from './steps'
import { tour, useTour } from './store'

const STEP_MS = 9000

/**
 * Runs the guided tour: signs in as each step's persona, opens its screen, spotlights the element
 * and narrates. Plays by itself; arrow keys move, space pauses, Escape ends. The spotlight never
 * blocks the page, so a visitor can try things mid-tour.
 */
export function TourOverlay() {
  const { step, playing } = useTour()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const persona = useRef<string | null>(null)
  const [ready, setReady] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const current = step === null ? null : STEPS[step]

  // Move to the step's persona and screen.
  useEffect(() => {
    if (step === null || !current) return
    let cancelled = false
    const run = async () => {
      if (current.persona && current.persona !== persona.current) {
        const me = unwrap(
          await api.POST('/api/v1/auth/persona/{key}', {
            params: { path: { key: current.persona } },
          }),
        )
        qc.removeQueries()
        qc.setQueryData(meQuery.queryKey, me)
        persona.current = current.persona
      }
      await navigate({ to: current.path })
      if (!cancelled) setReady(step)
    }
    void run().catch(() => tour.stop())
    return () => {
      cancelled = true
    }
  }, [step, current, navigate, qc])

  // Follow the spotlighted element as the page settles and scrolls.
  useEffect(() => {
    if (ready === null || ready !== step || !current) return
    let raf = 0
    let scrolled = false
    const find = () => {
      const el =
        document.querySelector(`[data-tour="${current.target}"]`) ??
        (current.target === 'main' ? document.querySelector('main') : null) ??
        (current.target ? document.getElementById(current.target) : null)
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
          scrolled = true
        }
        const r = el.getBoundingClientRect()
        setRect((prev) =>
          prev &&
          Math.abs(prev.top - r.top) < 1 &&
          Math.abs(prev.left - r.left) < 1 &&
          Math.abs(prev.width - r.width) < 1 &&
          Math.abs(prev.height - r.height) < 1
            ? prev
            : r,
        )
      } else setRect(null)
      raf = requestAnimationFrame(find)
    }
    raf = requestAnimationFrame(find)
    return () => cancelAnimationFrame(raf)
  }, [ready, step, current, reduce])

  // Auto-advance.
  useEffect(() => {
    if (step === null || !playing || ready !== step) return
    const t = window.setTimeout(() => {
      if (step + 1 < STEPS.length) tour.go(step + 1)
      else tour.stop()
    }, STEP_MS)
    return () => window.clearTimeout(t)
  }, [step, playing, ready])

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tour.stop()
      else if (e.key === 'ArrowRight' && step + 1 < STEPS.length) tour.go(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) tour.go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  if (step === null || !current) return null
  const pad = 10
  const tall = rect && rect.height > window.innerHeight * 0.7
  return (
    <>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] rounded-[16px] ring-2 ring-saffron transition-[top,left,width,height] duration-500 ease-out"
          style={{
            top: tall ? Math.max(rect.top, 8) - pad : rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: tall
              ? Math.min(rect.height, window.innerHeight * 0.62) + pad * 2
              : rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgb(10 14 23 / 0.5), 0 0 40px rgb(255 153 51 / 0.45)',
          }}
        />
      ) : null}
      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          role="dialog"
          aria-label="Guided tour"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 left-1/2 z-[80] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[18px] bg-board text-board-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] ring-1 ring-white/10"
        >
          <GuillocheBand height={10} color="rgb(255 153 51 / 0.45)" />
          <div className="px-6 pt-4 pb-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-saffron uppercase">
                {current.kicker}
              </p>
              <p className="font-mono text-[0.6875rem] text-board-ink/50">
                {step + 1} / {STEPS.length}
              </p>
            </div>
            <h2 className="mt-1.5 font-display text-[1.875rem] leading-[1.05]">{current.title}</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-board-ink/75">
              {current.body}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => tour.go(step - 1)}
                disabled={step === 0}
                className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
                aria-label="Previous step"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={tour.toggle}
                className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                aria-label={playing ? 'Pause the tour' : 'Play the tour'}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => (step + 1 < STEPS.length ? tour.go(step + 1) : tour.stop())}
                className="flex h-9 items-center gap-1.5 rounded-full bg-saffron px-4 text-[0.8125rem] font-semibold text-board hover:brightness-110"
              >
                {step + 1 < STEPS.length ? 'Next' : 'Finish'} <ChevronRight className="size-4" />
              </button>
              <div className="mx-3 h-1 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                {playing && ready === step ? (
                  <motion.div
                    key={`${step}-${playing}`}
                    className="h-full bg-saffron"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                  />
                ) : null}
              </div>
              <button
                type="button"
                onClick={tour.stop}
                className="grid size-9 place-items-center rounded-full text-board-ink/60 hover:bg-white/10 hover:text-white"
                aria-label="End the tour"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </motion.section>
      </AnimatePresence>
    </>
  )
}
