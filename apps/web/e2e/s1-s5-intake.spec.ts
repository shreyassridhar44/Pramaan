import { type Page, expect, test } from '@playwright/test'

import { SPECIMEN, asset, resetDemo, signInAs } from './helpers'

/** Fills the deposit form and walks the wizard with the given receipt and declared amount. */
async function submitDeposit(page: Page, receipt: string, amountRupees: string) {
  await signInAs(page, 'institution')
  await page.goto('/portal/submit')
  await page.getByLabel('Bank').selectOption({ label: SPECIMEN.bank })
  await page.getByLabel('Branch').fill(SPECIMEN.branch)
  await page.getByLabel('IFSC').fill(SPECIMEN.ifsc)
  await page.getByLabel('FDR or receipt number').fill(SPECIMEN.number)
  await page.getByLabel('Amount (Rs)').fill(amountRupees)
  await page.getByLabel('Issue date').fill(SPECIMEN.issue)
  await page.getByLabel('Maturity date').fill(SPECIMEN.maturity)
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.locator('input[type=file]').setInputFiles(asset(receipt))
  await expect(page.getByText('We read these values from your receipt')).toBeVisible({
    timeout: 90_000,
  })
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.locator('input[type=file]').setInputFiles(asset('specimen_affidavit_3.pdf'))
  await page.locator('input[type=checkbox]').last().check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Submit to AICTE' }).click()
  await expect(page.getByRole('heading', { name: 'Submitted to AICTE' })).toBeVisible()
}

async function openInstrument(page: Page, number: string) {
  await page.goto(`/instruments?q=${number}`)
  await page
    .getByRole('row', { name: new RegExp(number) })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: number })).toBeVisible()
}

test.describe.serial('S1 new FDR submission', () => {
  test.beforeAll(resetDemo)

  test('a genuine receipt is submitted, document-checked and queued for the officer', async ({
    page,
  }) => {
    await submitDeposit(page, 'specimen_fdr_genuine.jpg', '1500000')

    await signInAs(page, 'bureau')
    await page.goto('/queue')
    await expect(page.getByRole('option', { name: /Demo Institute of Technology/ })).toBeVisible()
    await openInstrument(page, SPECIMEN.number)
    await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Document-checked').first()).toBeVisible()
  })
})

test.describe.serial('S5 discrepancy identification', () => {
  test.beforeAll(resetDemo)

  test('an altered receipt raises a signal, the bank disagrees and a deficiency letter goes out', async ({
    page,
  }) => {
    await submitDeposit(page, 'specimen_fdr_altered.jpg', '3500000')

    await signInAs(page, 'bureau')
    await openInstrument(page, SPECIMEN.number)
    await expect(page.getByText(/figures.*words|words.*figures/i).first()).toBeVisible()

    await page.getByRole('tab', { name: 'Bank' }).click()
    await page.getByRole('button', { name: 'Request confirmation' }).click()
    await expect(page.getByText('waiting for the bank', { exact: true })).toBeVisible({
      timeout: 20_000,
    })

    await signInAs(page, 'bank')
    await page.goto('/bank')
    await page.getByRole('button', { name: /Sign and send the bank record/ }).click()
    await expect(page.getByText(/Signed and sent/)).toBeVisible({ timeout: 20_000 })

    await signInAs(page, 'bureau')
    await openInstrument(page, SPECIMEN.number)
    await expect(page.getByText('A0 Declared')).toBeVisible()
    await expect(page.getByText(/field in conflict/)).toBeVisible()

    await page.getByRole('button', { name: 'Return to institution' }).click()
    await page.getByRole('dialog').locator('textarea').fill('Amount in figures differs from words')
    await page.getByRole('dialog').getByRole('button', { name: 'Return' }).click()
    await expect(page.getByText(/deficiency letter AICTE\/RB\/SD\/DEF\//)).toBeVisible()

    await signInAs(page, 'institution')
    await page.goto('/portal/letters')
    await expect(page.getByText('Deficiency letter').first()).toBeVisible()
  })
})
