import { expect, test } from '@playwright/test'

import { signInAs } from './helpers'

test.describe('Management layer (Step 9)', () => {
  test('plain-language search shows chips, reports what it did not understand, and applies', async ({
    page,
  }) => {
    await signInAs(page, 'bureau')
    await page.goto('/instruments')
    await page
      .getByLabel('Ask in plain English')
      .fill('SBI and unconfirmed deposits in the Western region maturing before March 2027')
    await page.getByRole('button', { name: 'Interpret' }).click()
    const chips = page.getByRole('list', { name: 'Interpreted filters' })
    await expect(chips.getByText('Region Western')).toBeVisible()
    await expect(chips.getByText('Matures by 28 Feb 2027')).toBeVisible()
    await expect(page.getByText(/Not understood: SBI/)).toBeVisible()
    await chips.getByRole('button', { name: 'Remove A1 document-checked' }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(/maturity_to=2027-02-28/)
    await expect(page).toHaveURL(/assurance=%5B0%5D/)
    const rows = page.getByRole('row').filter({ hasText: /₹/ })
    await expect(rows.first()).toBeVisible()
    const regions = await rows.evaluateAll((els) =>
      els.slice(0, 10).map((e) => e.querySelector('[data-col="region"]')?.textContent?.trim()),
    )
    expect(new Set(regions)).toEqual(new Set(['Western']))
  })

  test('report totals reconcile with the command view', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/')
    const headline = page.getByText('Value held in trust').locator('xpath=following-sibling::p[1]')
    await expect(headline).toHaveText(/₹\d/)
    await page.waitForTimeout(900) // let the figure finish rolling
    const held = (await headline.textContent())?.trim()
    await page.goto('/reports?name=region-exposure')
    await expect(page.getByText(`Total ${held}`)).toBeVisible()
    const pdf = await page.request.get('/api/v1/reports/region-exposure/pdf')
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
  })

  test('a click on the maturity clock lists that month in the registry', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/')
    const clock = page.getByRole('group', { name: /^Maturity clock/ })
    await expect(clock).toBeVisible()
    await clock
      .getByRole('button', { name: / deposits$/ })
      .nth(2)
      .click()
    await expect(page).toHaveURL(/\/instruments\?.*maturity_from=\d{4}-\d{2}-01/)
  })

  test('the maturity runway lists a week, and the backlog, in the registry', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/')
    const week = page.getByRole('button', { name: /^Week of .* bank-confirmed$/ })
    await expect(week.first()).toBeVisible()
    await week.and(page.locator(':enabled')).first().click()
    await expect(page).toHaveURL(/\/instruments\?.*maturity_from=\d{4}-\d{2}-\d{2}.*maturity_to=/)
    await page.goto('/')
    await page.getByRole('button', { name: /^Already matured without action/ }).click()
    await expect(page).toHaveURL(/\/instruments\?.*status=/)
    await expect(page.getByRole('row').filter({ hasText: /₹/ }).first()).toBeVisible()
  })

  test('the river view still lists a month on click', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/')
    await page.getByRole('button', { name: 'River', exact: true }).click()
    const chart = page.getByRole('img', { name: 'Value maturing each month by proof level' })
    await expect(chart).toBeVisible()
    await chart.scrollIntoViewIfNeeded()
    const box = (await chart.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6)
    await expect(page).toHaveURL(/\/instruments\?.*maturity_from=\d{4}-\d{2}-01/)
  })

  test('the forecast plays forward week by week', async ({ page }) => {
    await signInAs(page, 'bureau')
    await page.goto('/forecast')
    const week = page
      .getByText('Forecast week of', { exact: true })
      .locator('xpath=following-sibling::p[1]')
    await expect(week).not.toHaveText(/--/)
    await page.waitForTimeout(1500) // let the board settle
    const first = await week.textContent()
    await page.getByRole('button', { name: '4x' }).click()
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(week).not.toHaveText(first ?? '', { timeout: 5000 })
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByText(/reminders?/).first()).toBeVisible()
  })

  test('a rule change creates a dated version and keeps the history', async ({ page }) => {
    await signInAs(page, 'section_head')
    await page.goto('/admin/rules')
    const reminders = page.getByRole('region', { name: 'Maturity reminders' })
    await reminders.getByRole('button', { name: 'Change' }).click()
    await reminders.getByLabel('Add a reminder offset in days').fill('120')
    await reminders.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(reminders.getByText('T-120')).toBeVisible()
    const next = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
    await reminders.getByLabel('In force from').fill(next)
    await reminders
      .getByLabel('Reason for the change')
      .fill('Add an early reminder from next quarter')
    await reminders.getByRole('button', { name: /Save as version/ }).click()
    await expect(page.getByText(/New rule version saved/)).toBeVisible()
    await reminders.getByRole('button', { name: /versions/ }).click()
    await expect(reminders.getByText('Add an early reminder from next quarter')).toBeVisible()
    // Still the old ladder today: the new version starts later.
    await expect(reminders.getByText('90, 60, 30, 15, 7, 0')).toBeVisible()
  })
})
