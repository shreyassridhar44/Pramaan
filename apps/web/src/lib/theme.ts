import { useCallback, useSyncExternalStore } from 'react'

type Theme = 'ledger' | 'command'
const KEY = 'pramaan.theme'
const listeners = new Set<() => void>()

function read(): Theme {
  const attr = document.documentElement.dataset.theme
  return attr === 'command' ? 'command' : 'ledger'
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function applyStoredTheme() {
  document.documentElement.dataset.theme = storedTheme() === 'command' ? 'command' : 'ledger'
}

export function setTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme
  if (persist) {
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this page.
    }
  }
  listeners.forEach((l) => l())
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'ledger' as Theme,
  )
  const toggle = useCallback(() => setTheme(theme === 'command' ? 'ledger' : 'command'), [theme])
  return { theme, toggle, setTheme }
}
