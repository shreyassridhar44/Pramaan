/**
 * Guilloche: the fine interlaced curves printed on banknotes, stamp paper and deposit receipts.
 * Patterns here are generated from a seed, so the same instrument number always draws the same
 * rosette and two different numbers practically never do. Coordinates are in a 200 x 200 box
 * centred at (100, 100) for rosettes, and in the caller's box for bands.
 */

/** FNV-1a: a small, stable string hash. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32: a deterministic generator for the pattern parameters. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type RosetteLayer = {
  /** Mean radius of the band, 0 to 100. */
  radius: number
  /** Lobes of the primary wave. */
  petals: number
  /** Lobes of the counter wave, which makes the strands cross. */
  counter: number
  /** Amplitudes of the two waves. */
  depth: number
  ripple: number
  /** Number of phase-shifted strands that weave the band. */
  strands: number
}

export type RosetteSpec = { layers: RosetteLayer[] }

/** Parameters for a rosette, derived from any text such as an instrument number. */
export function rosetteSpec(seed: string): RosetteSpec {
  const rand = seeded(hashSeed(seed))
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const outerPetals = pick(9, 18)
  return {
    layers: [
      {
        radius: 78,
        petals: outerPetals,
        counter: pick(3, 7),
        depth: 9 + rand() * 6,
        ripple: 3 + rand() * 4,
        strands: pick(10, 16),
      },
      {
        radius: 50,
        petals: pick(6, 12),
        counter: pick(2, 5),
        depth: 7 + rand() * 6,
        ripple: 2 + rand() * 3,
        strands: pick(8, 12),
      },
      {
        radius: 24,
        petals: pick(5, 9),
        counter: pick(2, 4),
        depth: 6 + rand() * 4,
        ripple: 1.5 + rand() * 2,
        strands: pick(6, 9),
      },
    ],
  }
}

const f = (n: number) => (Math.round(n * 10) / 10).toString()

/** One closed path per strand of a rosette layer. `detail` scales the point count. */
export function rosetteLayerPaths(layer: RosetteLayer, detail = 1): string[] {
  const steps = Math.max(90, Math.round(layer.petals * layer.counter * 12 * detail))
  const out: string[] = []
  for (let k = 0; k < layer.strands; k++) {
    const phase = (2 * Math.PI * k) / layer.strands
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const t = (2 * Math.PI * i) / steps
      const r =
        layer.radius +
        layer.depth * Math.sin(layer.petals * t + phase) +
        layer.ripple * Math.sin(layer.counter * t - phase * 2)
      d += `${i ? 'L' : 'M'}${f(100 + r * Math.cos(t))} ${f(100 + r * Math.sin(t))}`
    }
    out.push(d + 'Z')
  }
  return out
}

export type BandSpec = {
  width: number
  height: number
  /** Vertical centre of the band. */
  y: number
  amplitude: number
  wavelength: number
  counterWavelength: number
  counterAmplitude: number
  strands: number
}

/** A horizontal woven band, the border pattern of a certificate or note. */
export function bandPaths(b: BandSpec, step = 4): string[] {
  const out: string[] = []
  for (let k = 0; k < b.strands; k++) {
    const phase = (2 * Math.PI * k) / b.strands
    let d = ''
    for (let x = 0; x <= b.width + step; x += step) {
      const y =
        b.y +
        b.amplitude * Math.sin((2 * Math.PI * x) / b.wavelength + phase) +
        b.counterAmplitude * Math.sin((2 * Math.PI * x) / b.counterWavelength - phase)
      d += `${x ? 'L' : 'M'}${f(x)} ${f(y)}`
    }
    out.push(d)
  }
  return out
}
