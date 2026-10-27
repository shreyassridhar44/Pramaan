import { type Page, expect, test } from '@playwright/test'

/**
 * Pointer interactions across the officer workspace, run in Chrome, Firefox and WebKit (see
 * playwright.config.ts). Every step is a real click, as a person would make it.
 */
async function signInWithPersona(page: Page, name: string) {
  await page.goto('/signin')
  await page
    .getByRole('region', { name: 'Explore Pramaan as' })
    .getByRole('button', { name: new RegExp(name) })
    .click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0)
}

const NAV: [string, RegExp][] = [
  ['Verification queue', /\/queue/],
  ['Instruments', /\/instruments/],
  ['Institutions', /\/institutions/],
  ['Releases', /\/releases/],
  ['Alerts', /\/alerts/],
  ['Forecast', /\/forecast/],
  ['Reports', /\/reports/],
  ['Letters', /\/letters/],
  ['Audit', /\/audit/],
  ['Command', /\/$/],
]

test('every navigation link opens its page on the first click', async ({ page }) => {
  await signInWithPersona(page, 'Ananya Iyer')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  for (const [label, url] of NAV) {
    await nav.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(url)
  }
})

test('content next to the rail takes a click straight after a navigation click', async ({
  page,
}) => {
  await signInWithPersona(page, 'Ananya Iyer')
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Instruments', exact: true })
    .click()
  await expect(page).toHaveURL(/\/instruments/)
  // The instrument number sits at the left edge of the page, right beside the rail.
  const firstRow = page.getByRole('table', { name: 'Instruments' }).getByRole('row').nth(1)
  const number = firstRow.getByRole('link').first()
  const text = (await number.textContent())?.trim() ?? ''
  await number.click()
  await expect(page).toHaveURL(/\/instruments\/\d+/)
  await expect(page.getByText(text).first()).toBeVisible()
})

test('palette, theme, user menu and row clicks respond to one click', async ({ page }) => {
  await signInWithPersona(page, 'Ananya Iyer')

  await page.getByRole('button', { name: /Search or jump to/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.getByRole('button', { name: /(Command|Ledger) theme/ }).click()
  await expect(html).not.toHaveAttribute('data-theme', before ?? '')
  await page.getByRole('button', { name: /(Command|Ledger) theme/ }).click()
  await expect(html).toHaveAttribute('data-theme', before ?? 'ledger')

  await page.getByRole('button', { name: /Ananya Iyer/ }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Instruments', exact: true })
    .click()
  // A click anywhere on a row (not only on its link) opens the instrument.
  const row = page.getByRole('table', { name: 'Instruments' }).getByRole('row').nth(2)
  await row.locator('[data-col="region"]').click()
  await expect(page).toHaveURL(/\/instruments\/\d+/)
})

test('portal and bank home pages respond to clicks', async ({ page }) => {
  await signInWithPersona(page, 'Vikram Deshmukh')
  await expect(page).toHaveURL(/\/portal$/)
  await page
    .getByRole('link', { name: /Submit/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/portal\/submit/)

  // Leave the app first: its polling would race the next navigation once the session is gone.
  await page.goto('about:blank')
  await page.context().clearCookies()
  await signInWithPersona(page, 'Sanjay Bhat')
  await expect(page).toHaveURL(/\/bank$/)
})
