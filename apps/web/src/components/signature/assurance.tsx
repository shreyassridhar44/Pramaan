import { motion, useReducedMotion } from 'motion/react'

import { Rosette } from '@/components/security/guilloche'
import { Seal } from '@/components/security/seal'
import { Tip } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

import { ASSURANCE, type AssuranceLevel } from './assurance-meta'

/**
 * The proof ring: three segments for document check, bank confirmation and re-confirmation.
 * A0 renders as a dashed hollow ring. Colour is never the only cue: size 24 and up shows a
 * seal tick for bank-backed levels, and every ring has an accessible label.
 */
export function AssuranceRing({
  level,
  size = 24,
  animate = false,
  showTip = true,
  className,
}: {
  level: AssuranceLevel
  size?: number
  animate?: boolean
  showTip?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const meta = ASSURANCE[level]
  if (size >= 40) {
    const seal = <AssuranceSeal level={level} size={size} animate={animate} className={className} />
    if (!showTip) return seal
    return (
      <Tip
        content={
          <span>
            <strong className="font-semibold">
              {meta.short} {meta.name}.
            </strong>{' '}
            {meta.explain}
          </span>
        }
      >
        <span className="inline-flex">{seal}</span>
      </Tip>
    )
  }
  const stroke = Math.max(2, size / 9)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = level === 0 ? 0 : c * 0.035
  const seg = c / 3 - gap
  const ring = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Assurance ${meta.short}: ${meta.name}`}
      className={cn('shrink-0', className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={stroke}
        strokeDasharray={level === 0 ? `${c / 18} ${c / 36}` : undefined}
        opacity={level === 0 ? 1 : 0.55}
      />
      {[0, 1, 2].map((i) =>
        i < level ? (
          <motion.circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={meta.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${seg} ${c - seg}`}
            transform={`rotate(${-90 + i * 120 + (gap / c) * 180} ${size / 2} ${size / 2})`}
            initial={animate && !reduce ? { strokeDashoffset: seg } : false}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: animate ? i * 0.18 : 0, ease: [0.2, 0, 0, 1] }}
          />
        ) : null,
      )}
      {level >= 2 && size >= 24 ? (
        <path
          d={`M ${size * 0.33} ${size * 0.52} L ${size * 0.45} ${size * 0.63} L ${size * 0.68} ${size * 0.38}`}
          fill="none"
          stroke={meta.color}
          strokeWidth={Math.max(1.5, size / 14)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
  if (!showTip) return ring
  return (
    <Tip
      content={
        <span>
          <strong className="font-semibold">
            {meta.short} {meta.name}.
          </strong>{' '}
          {meta.explain}
        </span>
      }
    >
      <span className="inline-flex">{ring}</span>
    </Tip>
  )
}

export function AssuranceLabel({
  level,
  className,
}: {
  level: AssuranceLevel
  className?: string
}) {
  const meta = ASSURANCE[level]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[0.8125rem]', className)}>
      <AssuranceRing level={level} size={16} showTip={false} />
      <span className={cn('font-medium', meta.text)}>{meta.name}</span>
    </span>
  )
}

/**
 * The large form of the assurance mark (DECISION D36): proof drawn as security print. Declared
 * is an empty dashed outline, document-checked adds a watermark rosette, bank-confirmed is a full
 * embossed seal, and re-confirmed adds holographic foil. The level is always in the label.
 */
function AssuranceSeal({
  level,
  size,
  animate,
  className,
}: {
  level: AssuranceLevel
  size: number
  animate: boolean
  className?: string
}) {
  const meta = ASSURANCE[level]
  const label = `Assurance ${meta.short}: ${meta.name}`
  if (level <= 1)
    return (
      <span
        role="img"
        aria-label={label}
        className={cn('relative grid shrink-0 place-items-center rounded-full', className)}
        style={{ width: size, height: size }}
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full border-2 border-dashed',
            level === 0 ? 'border-a0/60' : 'border-a1/50',
          )}
        />
        {level === 1 ? (
          <Rosette
            seed="assurance-a1"
            size={size}
            layers={2}
            color="color-mix(in srgb, var(--a1) 45%, transparent)"
            draw={animate}
            className="absolute"
          />
        ) : null}
        <span
          aria-hidden
          className={cn('relative font-display leading-none', meta.text)}
          style={{ fontSize: size * 0.3 }}
        >
          {meta.short}
        </span>
      </span>
    )
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <Seal
        size={size}
        tone="green"
        stamp={animate}
        seed={`assurance-${level}`}
        legend={
          level === 3 ? 'Re-confirmed  •  Bank signed  •  ' : 'Bank-confirmed  •  Signed  •  '
        }
        rotate={-6}
      />
      {level === 3 ? (
        <span
          aria-hidden
          className="foil pointer-events-none absolute inset-[8%] rounded-full opacity-60"
        />
      ) : null}
    </span>
  )
}
