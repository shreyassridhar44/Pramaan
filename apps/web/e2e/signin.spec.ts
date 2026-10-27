import { expect, test } from '@playwright/test'

/**
 * Real clicks on the sign-in page, in every browser engine (see playwright.config.ts). The other
 * specs sign in through the API, so they cannot catch a sign-in that the interface drops.
 */
const PERSONAS: [string, RegExp][] = [
  ['Ananya Iyer', /\/$/],
  ['Vikram Deshmukh', /\/portal$/],
  ['Sanjay Bhat', /\/bank$/],
  ['Farah Siddiqui', /\/clearances$/],
]

for (const [label, home] of PERSONAS) {
  test(`a persona click signs in and lands on the home page: ${label}`, async ({ page }) => {
    // Visiting a protected page first caches "signed out", which is how people arrive: they land
    // on the public home page and click Sign in.
    await page.goto('/')
    await expect(page).toHaveURL(/\/home$/)
    await page.getByRole('banner').getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/signin/)
    const button = page
      .getByRole('region', { name: 'Explore Pramaan as' })
      .getByRole('button', { name: new RegExp(label) })
    await button.click()
    await expect(page).toHaveURL(home)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0)
  })
}

test('signing out and choosing another persona lands on its home page', async ({ page }) => {
  await page.goto('/signin')
  await page
    .getByRole('region', { name: 'Explore Pramaan as' })
    .getByRole('button', { name: /Vikram Deshmukh/ })
    .click()
  await expect(page).toHaveURL(/\/portal$/)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/signin/)
  await page
    .getByRole('region', { name: 'Explore Pramaan as' })
    .getByRole('button', { name: /Sanjay Bhat/ })
    .click()
  await expect(page).toHaveURL(/\/bank$/)
})
