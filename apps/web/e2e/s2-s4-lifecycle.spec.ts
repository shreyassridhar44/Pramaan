import { type Page, expect, test } from '@playwright/test'

import { SPECIMEN, asset, resetDemo, signInAs } from './helpers'

type Held = {
  id: number
  number: string
  maturity_date: string
  status: string
  can_renew: boolean
}

async function demoDeposits(page: Page): Promise<Held[]> {
  await signInAs(page, 'institution')
  const home = await (await page.request.get('/api/v1/portal/home')).json()
  return home.instruments as Held[]
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

test.describe.serial('S2 validity tracking', () => {
  test.beforeAll(resetDemo)

  test('status follows active, maturing and matured as the as-of date moves', async ({ page }) => {
    const target = (await demoDeposits(page)).find((i) => i.status === 'maturing')!
    expect(target).toBeTruthy()
    await signInAs(page, 'bureau')
    const cases: [string, string][] = [
      [shift(target.maturity_date, -150), 'Active'],
      [shift(target.maturity_date, -30), 'Maturing'],
      [shift(target.maturity_date, 5), 'Matured, no action'],
    ]
    for (const [asOf, label] of cases) {
      await page.goto(`/instruments/${target.id}?asOf=${asOf}`)
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
      await page.goto(`/instruments?q=${target.number}&asOf=${asOf}`)
      const row = page.getByRole('row', { name: new RegExp(target.number) })
      await expect(row.getByText(label, { exact: true })).toBeVisible()
    }
  })
})

test.describe.serial('S4 renewal', () => {
  test.beforeAll(resetDemo)

  test('a renewal is linked to its predecessor, confirmed by the bank and closes the old deposit', async ({
    page,
  }) => {
    const pred = (await demoDeposits(page)).find((i) => i.can_renew && i.status === 'maturing')!
    await page.goto('/portal')
    await page
      .getByRole('listitem')
      .filter({ hasText: pred.number })
      .getByRole('link', { name: 'Submit renewal' })
      .click()
    await expect(page.getByRole('heading', { name: 'Submit a renewal' })).toBeVisible()
    await page.getByLabel('Bank').selectOption({ label: SPECIMEN.bank })
    await page.getByLabel('Branch').fill(SPECIMEN.branch)
    await page.getByLabel('IFSC').fill(SPECIMEN.ifsc)
    await page.getByLabel('FDR or receipt number').fill(SPECIMEN.number)
    await page.getByLabel('Amount (Rs)').fill('1500000')
    await page.getByLabel('Issue date').fill(SPECIMEN.issue)
    await page.getByLabel('Maturity date').fill(SPECIMEN.maturity)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.locator('input[type=file]').setInputFiles(asset('specimen_fdr_genuine.jpg'))
    await expect(page.getByText('We read these values from your receipt')).toBeVisible({
      timeout: 90_000,
    })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.locator('input[type=file]').setInputFiles(asset('specimen_affidavit_3.pdf'))
    await page.locator('input[type=checkbox]').last().check()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Submit to AICTE' }).click()
    await expect(page.getByRole('heading', { name: 'Submitted to AICTE' })).toBeVisible()

    await signInAs(page, 'bureau')
    await page.goto(`/instruments?q=${SPECIMEN.number}`)
    await page
      .getByRole('row', { name: new RegExp(SPECIMEN.number) })
      .first()
      .click()
    await page.getByRole('tab', { name: 'Bank' }).click()
    await page.getByRole('button', { name: 'Request confirmation' }).click()
    await expect(page.getByText('waiting for the bank', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    const url = page.url()

    await signInAs(page, 'bank')
    await page.goto('/bank')
    await page.getByRole('button', { name: /Sign and send the bank record/ }).click()
    await expect(page.getByText('Signed and sent to AICTE.')).toBeVisible({ timeout: 20_000 })

    await signInAs(page, 'bureau')
    await page.goto(url)
    await expect(page.getByText('A2 Bank-confirmed')).toBeVisible()
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('Verified. The instrument is now active.')).toBeVisible()
    await expect(page.getByText(pred.number).first()).toBeVisible()

    await page.goto(`/instruments/${pred.id}`)
    await expect(page.getByText('Renewed', { exact: true }).first()).toBeVisible()
  })
})

test.describe.serial('Observations and corrections (R10)', () => {
  test.beforeAll(resetDemo)

  test('an officer records an observation and corrects a field with a reason', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/queue')
    await page.getByRole('link', { name: 'Open full record' }).click()
    await page
      .getByLabel('Add an observation')
      .fill('Receipt seal is faint; bank confirmation requested')
    await page.getByRole('button', { name: 'Record observation' }).click()
    await expect(page.getByText('Receipt seal is faint; bank confirmation requested')).toBeVisible()

    await page.getByRole('button', { name: 'Correct holders' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Corrected value').fill('Member Secretary, AICTE; Secretary, Trust')
    await dialog.getByLabel('Reason').fill('Trust name abbreviated on the form; confirmed by email')
    await dialog.getByRole('button', { name: 'Save correction' }).click()
    await expect(page.getByText(/Corrected from .* by Ananya Iyer/)).toBeVisible()
  })
})

test.describe('Region scope (R13)', () => {
  test('a regional officer sees only their region in the registry', async ({ page }) => {
    await signInAs(page, 'regional')
    await page.goto('/instruments')
    const rows = page.getByRole('row').filter({ hasText: /₹/ })
    await expect(rows.first()).toBeVisible()
    const regions = await rows.evaluateAll((els) =>
      els.slice(0, 25).map((e) => e.querySelector('[data-col="region"]')?.textContent?.trim()),
    )
    expect(new Set(regions)).toEqual(new Set(['Western']))
  })
})
