import { motion, useReducedMotion } from 'motion/react'
import { useMemo, type CSSProperties } from 'react'

import { cn } from '@/lib/cn'
import { bandPaths, rosetteLayerPaths, rosetteSpec, type BandSpec } from '@/lib/guilloche'

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
        .map((l) => rosetteLayerPaths(size < 64 ? { ...l, strands: Math.ceil(l.strands / 2) } : l, level)),
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

const maskCache = new Map<string, string>()

function svgUrl(body: string, w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** A rosette as a CSS mask, so many of them cost one image each and follow the theme colour. */
export function rosetteMask(seed: string, layers = 3): string {
  const key = `r:${seed}:${layers}`
  let url = maskCache.get(key)
  if (!url) {
    const body = rosetteSpec(seed)
      .layers.slice(0, layers)
      .map(
        (l) =>
          `<g fill="none" stroke="#000" stroke-width="0.45">${rosetteLayerPaths(l, 0.7)
            .map((d) => `<path d="${d}"/>`)
            .join('')}</g>`,
      )
      .join('')
    url = svgUrl(body, 200, 200)
    maskCache.set(key, url)
  }
  return url
}

/** A woven band as a CSS mask, tiled horizontally. */
export function bandMask(spec: Partial<BandSpec> = {}): string {
  const b: BandSpec = {
    width: 480,
    height: 48,
    y: 24,
    amplitude: 9,
    wavelength: 60,
    counterWavelength: 160,
    counterAmplitude: 6,
    strands: 9,
    ...spec,
  }
  const key = `b:${JSON.stringify(b)}`
  let url = maskCache.get(key)
  if (!url) {
    const body = `<g fill="none" stroke="#000" stroke-width="0.6">${bandPaths(b)
      .map((d) => `<path d="${d}"/>`)
      .join('')}</g>`
    url = svgUrl(body, b.width, b.height)
    maskCache.set(key, url)
  }
  return url
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
