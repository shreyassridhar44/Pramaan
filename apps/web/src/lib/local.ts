import { useCallback, useState } from 'react'

/** Per-viewer conveniences kept in this browser only. Storage can be blocked or cleared, so every
 * read and write is guarded and the page works without it. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Not saved; the in-memory value still applies for this visit.
  }
}

export function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => readLocal(key, fallback))
  const set = useCallback(
    (v: T) => {
      setValue(v)
      writeLocal(key, v)
    },
    [key],
  )
  return [value, set]
}
