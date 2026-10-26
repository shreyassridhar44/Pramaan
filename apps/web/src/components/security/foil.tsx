import { useReducedMotion } from 'motion/react'
import { useRef, type HTMLAttributes, type PointerEvent } from 'react'

import { cn } from '@/lib/cn'

/**
 * A holographic foil layer, like the hologram stripe on a banknote or a passport page. The sheen
 * follows the pointer; children render above it. `tilt` also leans the surface slightly.
 */
export function Foil({
  className,
  children,
  tilt = false,
  intensity = 1,
  always = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tilt?: boolean; intensity?: number; always?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || reduce) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--fx', `${x * 100}%`)
    el.style.setProperty('--fy', `${y * 100}%`)
    el.style.setProperty('--fa', `${(x + y) * 180}`)
    if (tilt) el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg)`
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = ''
  }
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className={cn('group/foil relative isolate transition-transform duration-300 ease-out', className)}
      {...props}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          'foil pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300',
          always ? 'opacity-[var(--foil-o)]' : 'opacity-0 group-hover/foil:opacity-[var(--foil-o)]',
        )}
        style={{ ['--foil-o' as string]: 0.38 * intensity }}
      />
    </div>
  )
}
