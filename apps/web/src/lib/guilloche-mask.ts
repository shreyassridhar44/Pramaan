import { bandPaths, rosetteLayerPaths, rosetteSpec, type BandSpec } from './guilloche'

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
