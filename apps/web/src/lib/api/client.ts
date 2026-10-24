import createClient from 'openapi-fetch'

import type { paths } from './schema'

/**
 * Typed API client generated from the FastAPI OpenAPI schema (`npm run api:types`).
 * Session cookies are sent automatically; state-changing calls add the CSRF header.
 */
export const api = createClient<paths>({ baseUrl: '/', credentials: 'include' })

api.use({
  onRequest({ request }) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const token = readCookie('pramaan_csrf')
      if (token) request.headers.set('x-csrf-token', token)
    }
    return request
  },
})

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1]
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message)
  }
}

type ErrorBody = { error?: { code?: string; message?: string; request_id?: string } }

/** Unwraps an openapi-fetch result, throwing an ApiError with the server's message. */
export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined || result.data === undefined) {
    const body = (result.error ?? {}) as ErrorBody
    throw new ApiError(
      body.error?.code ?? 'unknown',
      body.error?.message ?? 'The request failed.',
      body.error?.request_id,
    )
  }
  return result.data
}
