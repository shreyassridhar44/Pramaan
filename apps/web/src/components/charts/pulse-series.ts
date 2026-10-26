/** The kinds of activity drawn on the pulse monitor, in drawing order. */
export const PULSE_SERIES = [
  { key: 'submitted', label: 'Submitted', color: 'var(--board-ink)' },
  { key: 'checked', label: 'Checked', color: 'var(--chart-a1)' },
  { key: 'bank', label: 'Bank-confirmed', color: 'var(--board-a2)' },
  { key: 'reminders', label: 'Reminders sent', color: 'var(--saffron)' },
  { key: 'released', label: 'Released or renewed', color: 'var(--simulated)' },
] as const
