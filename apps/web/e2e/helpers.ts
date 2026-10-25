import { type APIRequestContext, type Page, expect, request } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ASSETS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../services/api/app/demo_assets',
)
export const asset = (name: string) => path.join(ASSETS, name)

export const SPECIMEN = {
  bank: 'Bharat National Bank',
  branch: 'Pune Main',
  ifsc: 'BHNX0411002',
  number: '64226103458812',
  issue: '2026-10-20',
  maturity: '2036-10-20',
}

/** Signs in as a demo persona through the API, sharing the page's cookies. */
export async function signInAs(page: Page, persona: string) {
  // Leave the app first: its polling requests would otherwise refresh the old session cookie.
  await page.goto('about:blank')
  await page.context().clearCookies()
  const r = await page.request.post(`/api/v1/auth/persona/${persona}`)
  expect(r.ok()).toBeTruthy()
}

async function adminContext(): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: 'http://localhost:8000' })
  const r = await ctx.post('/api/v1/auth/persona/admin')
  expect(r.ok()).toBeTruthy()
  return ctx
}

/** Restores the seeded demo data so each scenario starts from the same state. */
export async function resetDemo() {
  const ctx = await adminContext()
  const state = await ctx.storageState()
  const csrf = state.cookies.find((c) => c.name === 'pramaan_csrf')?.value ?? ''
  const r = await ctx.post('/api/v1/demo/reset', {
    headers: { 'x-csrf-token': csrf },
    timeout: 180_000,
  })
  expect(r.ok()).toBeTruthy()
  await ctx.dispose()
}
