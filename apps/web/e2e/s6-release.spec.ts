import { expect, test } from '@playwright/test'

import { resetDemo, signInAs } from './helpers'

const STORY = 'Sahyadri College of Engineering, Nashik'

test.describe.serial('S6 authorised release processing', () => {
  test.beforeAll(resetDemo)

  test('PGRC blocks until the complaint is resolved, only the authority issues the NOC, and the QR verifies', async ({
    page,
    browser,
  }) => {
    await signInAs(page, 'bureau')
    await page.goto('/releases')
    await page
      .getByRole('row', { name: new RegExp(STORY) })
      .first()
      .click()
    await expect(page.getByText(/open complaint to resolve/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Issue NOC' })).toHaveCount(0)
    const caseUrl = page.url()

    await signInAs(page, 'pgrc')
    await page.goto('/clearances')
    await page.getByRole('option', { name: new RegExp(STORY) }).click()
    await page.getByRole('button', { name: 'Mark resolved' }).click()
    await page.getByRole('dialog').locator('textarea').fill('Refund paid; complainant confirmed')
    await page.getByRole('dialog').getByRole('button', { name: 'Close complaint' }).click()
    await expect(page.getByText('Complaint closed.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear', exact: true }).click()
    await page.getByRole('dialog').locator('textarea').fill('No grievance pending')
    await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(page.getByText('Decision recorded in the case and the audit trail.')).toBeVisible()

    await signInAs(page, 'authority')
    await page.goto(caseUrl)
    await page.getByRole('button', { name: 'Issue NOC' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sign and issue the NOC' }).click()
    await expect(page.getByRole('heading', { name: 'NOC issued' })).toBeVisible()
    const verifyUrl = await page
      .getByRole('link', { name: 'Verification page' })
      .getAttribute('href')
    expect(verifyUrl).toContain('/verify/')

    // A phone with no session.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p = await phone.newPage()
    await p.goto(verifyUrl!)
    await expect(p.getByText('Genuine', { exact: true })).toBeVisible()
    await expect(p.getByText(STORY)).toBeVisible()

    await page.keyboard.press('Escape')
    await page.goto('/letters')
    await page.getByRole('button', { name: 'Revoke', exact: true }).click()
    await page.getByRole('dialog').locator('textarea').fill('Issued against the wrong branch')
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke', exact: true }).click()
    await expect(page.getByText(/Letter revoked/)).toBeVisible()

    await p.reload()
    await expect(p.getByText('Revoked', { exact: true })).toBeVisible()
    await p.goto(`${verifyUrl!.slice(0, -4)}AAAA`)
    await expect(p.getByText('Not recognised', { exact: true })).toBeVisible()
    await phone.close()
  })
})
