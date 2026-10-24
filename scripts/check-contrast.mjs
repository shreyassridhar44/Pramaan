// Verifies WCAG 2.2 contrast for the token pairs used in Pramaan, in both themes.
// Reads apps/web/src/styles/tokens.css so the check always matches the shipped tokens.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../apps/web/src/styles/tokens.css'), 'utf8')

function block(selector) {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`selector not found: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  const vars = {}
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [foreground, background, minimum ratio]. 4.5 for text, 3 for large text and UI marks.
const pairs = [
  ['ink', 'canvas', 4.5], ['ink', 'surface', 4.5], ['ink-2', 'surface', 4.5], ['ink-2', 'canvas', 4.5],
  ['ink-3', 'surface', 4.5], ['ink-3', 'canvas', 4.5], ['ink-3', 'surface-sunken', 4.5],
  ['brand-contrast', 'brand', 4.5], ['brand', 'surface', 4.5], ['accent', 'surface', 3],
  ['a0', 'surface', 3], ['a1', 'surface', 4.5], ['a2', 'surface', 4.5], ['a3', 'surface', 4.5],
  ['a1', 'a1-soft', 4.5], ['a2', 'a2-soft', 4.5], ['a0', 'a0-soft', 3],
  ['due', 'surface', 4.5], ['due', 'due-soft', 4.5], ['overdue', 'surface', 4.5],
  ['overdue', 'overdue-soft', 4.5], ['simulated', 'surface', 4.5], ['simulated', 'simulated-soft', 4.5],
]

let failures = 0
for (const [theme, selector] of [['ledger', ':root'], ['command', "[data-theme='command']"]]) {
  const vars = block(selector)
  for (const [fg, bg, min] of pairs) {
    const r = ratio(vars[fg], vars[bg])
    const ok = r >= min
    if (!ok) failures++
    console.log(`${ok ? 'pass' : 'FAIL'}  ${theme.padEnd(8)} ${fg} on ${bg}: ${r.toFixed(2)} (min ${min})`)
  }
}
if (failures) {
  console.error(`\n${failures} contrast pair(s) below the minimum.`)
  process.exit(1)
}
console.log('\nAll contrast pairs pass.')
