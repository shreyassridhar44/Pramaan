import { motion, useReducedMotion } from 'motion/react'
import { useMemo, type CSSProperties } from 'react'

import { cn } from '@/lib/cn'
import { rosetteLayerPaths, rosetteSpec, type BandSpec } from '@/lib/guilloche'
import { bandMask, rosetteMask } from '@/lib/guilloche-mask'

/**
 * A seeded guilloche rosette drawn as SVG. `layers` limits how many bands are drawn (outer
 * first), `draw` traces the strands in once on mount. Purely decorative unless a label is given.
 */
export function Rosette({
  seed,
  size = 200,
  layers = 3,
  color = 'var(--guilloche)',
  strokeWidth = 0.55,
  detail,
  draw = false,
  label,
  className,
  style,
}: {
  seed: string
  size?: number
  layers?: number
  color?: string
  strokeWidth?: number
  detail?: number
  draw?: boolean
  label?: string
  className?: string
  style?: CSSProperties
}) {
  const reduce = useReducedMotion()
  const level = detail ?? (size >= 160 ? 1 : size >= 64 ? 0.6 : 0.3)
  const paths = useMemo(
    () =>
      rosetteSpec(seed)
        .layers.slice(0, layers)
        .map((l) =>
          rosetteLayerPaths(size < 64 ? { ...l, strands: Math.ceil(l.strands / 2) } : l, level),
        ),
    [seed, layers, level, size],
  )
  const animate = draw && !reduce
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0', className)}
      style={style}
    >
      {paths.map((layer, li) => (
        <g key={li} fill="none" stroke={color} strokeWidth={(strokeWidth * 200) / size}>
          {layer.map((d, i) =>
            animate ? (
              <motion.path
                key={i}
                d={d}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.6, delay: li * 0.35 + i * 0.03, ease: [0.2, 0, 0, 1] }}
              />
            ) : (
              <path key={i} d={d} />
            ),
          )}
        </g>
      ))}
    </svg>
  )
}

/** A rosette painted through a mask: cheap enough for every panel and row. */
export function RosetteMark({
  seed,
  layers = 3,
  className,
  color = 'var(--guilloche)',
  style,
}: {
  seed: string
  layers?: number
  className?: string
  color?: string
  style?: CSSProperties
}) {
  const mask = rosetteMask(seed, layers)
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none block shrink-0', className)}
      style={{
        backgroundColor: color,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        ...style,
      }}
    />
  )
}

/** A woven border band, as printed along the edge of a certificate. */
export function GuillocheBand({
  className,
  color = 'var(--guilloche)',
  height = 48,
  spec,
}: {
  className?: string
  color?: string
  height?: number
  spec?: Partial<BandSpec>
}) {
  const mask = bandMask({ height, y: height / 2, ...spec })
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none block w-full', className)}
      style={{
        height,
        backgroundColor: color,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: `auto ${height}px`,
        WebkitMaskSize: `auto ${height}px`,
        maskRepeat: 'repeat-x',
        WebkitMaskRepeat: 'repeat-x',
      }}
    />
  )
}
