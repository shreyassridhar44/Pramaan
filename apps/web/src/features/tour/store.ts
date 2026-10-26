import { useSyncExternalStore } from 'react'

/** Where the guided tour is: off, or on a step. Kept outside React so it survives navigation. */
type TourState = { step: number | null; playing: boolean }

let state: TourState = { step: null, playing: true }
const listeners = new Set<() => void>()

function set(next: Partial<TourState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const tour = {
  start: () => set({ step: 0, playing: true }),
  stop: () => set({ step: null }),
  go: (step: number) => set({ step }),
  toggle: () => set({ playing: !state.playing }),
}

export function useTour(): TourState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}
