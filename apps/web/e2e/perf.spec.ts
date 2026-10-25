import { expect, test } from '@playwright/test'

import { signInAs } from './helpers'

/** STEPS.md Step 5: the registry is interactive within 1.5 s. Measured on the dev server, which
 * serves unbundled modules, so a production build is faster than this bound. */
test('registry shows its first rows within 1.5 seconds', async ({ page }) => {
  await signInAs(page, 'bureau')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const started = Date.now()
  await page.getByRole('link', { name: 'Instruments' }).first().click()
  await expect(page.getByRole('row').nth(2)).toBeVisible()
  const elapsed = Date.now() - started
  test.info().annotations.push({ type: 'registry_ms', description: String(elapsed) })
  console.log(`registry interactive in ${elapsed} ms`)
  expect(elapsed).toBeLessThan(1500)
})
