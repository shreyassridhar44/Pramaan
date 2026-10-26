/** The token from a verification link, or the text itself when it is a bare code. */
export function tokenFrom(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/\/verify\/([^/?#\s]+)/)
  if (m) return decodeURIComponent(m[1]!)
  return /^[\w.~-]{8,}$/.test(t) ? t : null
}
