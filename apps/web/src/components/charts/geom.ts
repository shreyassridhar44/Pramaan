/** Polar helpers for the radial charts. Angles are degrees clockwise from twelve o'clock. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** An annular sector from radius r1 to r2 between angles a1 and a2. */
export function sector(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(cx, cy, r2, a1)
  const [x2, y2] = polar(cx, cy, r2, a2)
  const [x3, y3] = polar(cx, cy, r1, a2)
  const [x4, y4] = polar(cx, cy, r1, a1)
  const large = a2 - a1 > 180 ? 1 : 0
  return `M${x1} ${y1} A${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 ${large} 0 ${x4} ${y4}Z`
}
