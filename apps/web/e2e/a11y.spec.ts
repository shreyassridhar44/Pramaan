import AxeBuilder from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'

import { signInAs } from './helpers'

/** Every route, as the persona that uses it (TEST_PLAN.md Section 4: axe on every route). */
const ROUTES: [string, string][] = [
  ['-', '/signin'],
  ['bureau', '/'],
  ['bureau', '/queue'],
  ['bureau', '/instruments'],
  ['bureau', '/instruments/1'],
  ['bureau', '/institutions'],
  ['bureau', '/institutions/1'],
  ['bureau', '/releases'],
  ['bureau', '/releases/1'],
  ['bureau', '/letters'],
  ['bureau', '/audit'],
  ['bureau', '/forecast'],
  ['bureau', '/reports'],
  ['section_head', '/admin/rules'],
  ['institution', '/portal'],
  ['institution', '/portal/submit'],
  ['institution', '/portal/release'],
  ['institution', '/portal/letters'],
  ['bank', '/bank'],
  ['pgrc', '/clearances'],
]

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }))
}

for (const theme of ['ledger', 'command'] as const) {
  test.describe(`accessibility, ${theme} theme`, () => {
    for (const [persona, path] of ROUTES) {
      test(`${path} as ${persona}`, async ({ page }) => {
        if (persona === '-') {
          await page.goto('about:blank')
          await page.context().clearCookies()
        } else {
          await signInAs(page, persona)
        }
        await page.goto('/signin')
        await page.evaluate((t) => localStorage.setItem('pramaan.theme', t), theme)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        // Let entrance animations settle so contrast is measured on final colours.
        await page.waitForTimeout(800)
        expect(await seriousViolations(page)).toEqual([])
      })
    }
  })
}

test('public verify page', async ({ page }) => {
  await page.goto('/verify/not-a-token')
  await expect(page.getByText('Not recognised', { exact: true })).toBeVisible()
  expect(await seriousViolations(page)).toEqual([])
})
