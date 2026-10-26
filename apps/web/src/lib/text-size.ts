import { useSyncExternalStore } from 'react'

/** Text size control from the government web guidelines (GIGW): A-, A and A+. */
export type TextSize = 'small' | 'normal' | 'large'
const KEY = 'pramaan.text-size'
const PX: Record<TextSize, string> = { small: '15px', normal: '16px', large: '17.5px' }
const listeners = new Set<() => void>()
let current: TextSize = 'normal'

export function applyStoredTextSize() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'small' || v === 'large') current = v
  } catch {
    // Storage can be unavailable; the default size applies.
  }
  document.documentElement.style.fontSize = PX[current]
}

export function setTextSize(size: TextSize) {
  current = size
  document.documentElement.style.fontSize = PX[size]
  try {
    localStorage.setItem(KEY, size)
  } catch {
    // The size still applies for this page.
  }
  listeners.forEach((l) => l())
}

export function useTextSize() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => 'normal' as TextSize,
  )
}
