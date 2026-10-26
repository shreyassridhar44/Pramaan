import { expect, test } from '@playwright/test'

import { signInAs } from './helpers'

/**
 * The security-print surfaces (DECISION D36, D37): public home, guided tour, tamper drill, legacy
 * import, reminder previews and the deposit passport. Run in Chrome, Firefox and WebKit.
 */
test('a signed-out visitor lands on the public home with live figures', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/instruments')
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { name: /Every rupee held in trust/ })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Portfolio board' })).toContainText(
    'HELD IN TRUST',
    {
      ignoreCase: true,
    },
  )
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect(page.locator('html')).toHaveAttribute('style', /17\.5px/)
  await page.getByRole('button', { name: 'Normal text' }).click()
})

test('verifying a code from the home page opens the verify page', async ({ page }) => {
  await page.goto('/home')
  await page
    .getByLabel('Verification link or code')
    .fill('https://example.org/verify/not-a-real-token-123')
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page).toHaveURL(/\/verify\/not-a-real-token-123/)
  await expect(page.getByText('Not recognised')).toBeVisible()
})

test('the guided tour plays across personas', async ({ page }) => {
  await page.goto('/home?tour=1')
  const tour = page.getByRole('dialog', { name: 'Guided tour' })
  await expect(tour).toContainText('Proof you can see')
  await tour.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(tour).toContainText('How much we hold')
  await page.keyboard.press('Escape')
  await expect(tour).toHaveCount(0)
})

test('the tamper drill breaks the chain at the edited entry and restore mends it', async ({
  page,
}) => {
  await signInAs(page, 'auditor')
  await page.goto('/audit')
  await page.getByRole('button', { name: 'Tamper with an entry' }).click()
  await expect(page.getByText(/Broken at entry #\d+/)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Restore the entry' }).click()
  await expect(page.getByText('Every link is intact.')).toBeVisible({ timeout: 30_000 })
})

test('the sample legacy register reconciles row by row', async ({ page }) => {
  await signInAs(page, 'bureau')
  await page.goto('/admin/import')
  await page.getByRole('button', { name: 'Reconcile the sample register' }).click()
  await expect(page.getByText(/rows reconciled in/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /Not in Pramaan/ })).toContainText(/\d/)
  await expect(page.getByRole('table')).toContainText(/Values differ|Not in Pramaan/)
})

test('a reminder shows the message the institution received', async ({ page }) => {
  await signInAs(page, 'bureau')
  await page.goto('/alerts')
  await page.getByRole('button', { name: 'See message' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'What the institution received' })
  await expect(dialog).toContainText('सुरक्षा जमा')
  await dialog.getByRole('button', { name: 'English' }).click()
  await expect(dialog).toContainText('Security deposit')
})
