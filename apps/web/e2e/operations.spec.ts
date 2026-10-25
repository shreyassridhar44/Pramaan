import { expect, test } from '@playwright/test'

import { resetDemo, signInAs } from './helpers'

// The seed puts a closure penalty on one release case (app/seed/portfolio.py).
const PENALTY_CASE = 68

test.describe('Operations: alerts, bulk actions, views and penalties', () => {
  test.beforeAll(async () => {
    await resetDemo()
  })

  test('alerts show every kind of reminder and the escalation ladder', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/alerts')
    await page.getByLabel('Alert kind').selectOption('monitoring.reconfirm')
    const table = page.getByRole('region', { name: 'Reminders sent' })
    await expect(table.getByText('Re-confirmation due').first()).toBeVisible()
    await expect(table.getByText('Maturity reminder')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Escalations' }).click()
    await expect(page).toHaveURL(/tab=escalations/)
    const esc = page.getByRole('region', { name: 'Open escalations' })
    await expect(esc.getByRole('link').first()).toBeVisible()
    await expect(
      esc.getByText(/Director|Deputy director|Section head|Dealing officer/).first(),
    ).toBeVisible()
  })

  test('bulk actions report what they did and what they skipped', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/instruments?status=%5B%22active%22%5D')
    await page
      .getByLabel(/^Select \d+/)
      .nth(0)
      .check()
    await page
      .getByLabel(/^Select \d+/)
      .nth(1)
      .check()
    const bar = page.getByRole('region', { name: 'Selected instruments' })
    await expect(bar.getByText('2 selected')).toBeVisible()
    await bar.getByRole('button', { name: 'Send reminder' }).click()
    await expect(page.getByText('Reminder sent for 2 deposits.')).toBeVisible()
    await expect(bar).toHaveCount(0)

    await page
      .getByLabel(/^Select \d+/)
      .nth(0)
      .check()
    const officer = await bar
      .getByLabel('Assign to an officer')
      .locator('option')
      .nth(1)
      .textContent()
    await bar.getByLabel('Assign to an officer').selectOption({ label: officer! })
    await expect(page.getByText('Assigned 1 deposit.')).toBeVisible()
    await expect(page.getByRole('row').nth(1).getByText(officer!)).toBeVisible()

    await page
      .getByLabel(/^Select \d+/)
      .nth(0)
      .check()
    await bar.getByLabel('Assign to an officer').selectOption({ label: officer! })
    await expect(page.getByText(/skipped 1 already assigned to this officer/)).toBeVisible()
  })

  test('saved views and the column chooser are kept for the viewer', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/instruments?region=%5B%22western%22%5D&sort=-amount')
    await page.getByRole('button', { name: /^Views/ }).click()
    await page.getByLabel('View name').fill('Western, largest first')
    await page.getByRole('button', { name: 'Save current' }).click()
    await page.getByRole('button', { name: 'Close' }).click()

    await page.goto('/instruments')
    await page.getByRole('button', { name: /^Views/ }).click()
    await page.getByRole('button', { name: 'Western, largest first', exact: true }).click()
    await expect(page).toHaveURL(/sort=-amount/)
    await expect(page).toHaveURL(/region=/)

    await page.getByRole('button', { name: 'Columns' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Bank' }).click()
    await page.keyboard.press('Escape')
    const header = page.getByRole('row').first()
    await expect(header.getByRole('columnheader', { name: 'Bank' })).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByRole('row').first().getByRole('columnheader', { name: 'Bank' }),
    ).toHaveCount(0)
  })

  test('a penalty must be recorded as paid before release', async ({ page }) => {
    await signInAs(page, 'authority')
    await page.goto(`/releases/${PENALTY_CASE}`)
    await expect(page.getByText(/Penalties settled/).first()).toBeVisible()
    await expect(page.getByText('APH 2024-27 Clause 2.21 h')).toBeVisible()
    await page.getByRole('button', { name: 'Record payment' }).click()
    await page.getByLabel('Reason').fill('UTR 2026102500123')
    await page.getByRole('dialog').getByRole('button', { name: 'Record payment' }).click()
    await expect(
      page.getByText('Penalty recorded as paid. The condition is now met.'),
    ).toBeVisible()
    await expect(page.getByText(/Paid, reference/)).toBeVisible()
    await expect(page.getByText('UTR 2026102500123')).toBeVisible()
  })
})
