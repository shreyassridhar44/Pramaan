import { createFileRoute } from '@tanstack/react-router'

import { ReleaseList } from '@/features/releases/release-list'

export const Route = createFileRoute('/_app/releases/')({
  staticData: { title: 'Releases' },
  validateSearch: (s: Record<string, unknown>): { state?: 'open' | 'closed' } => ({
    state: s.state === 'closed' ? 'closed' : undefined,
  }),
  component: Page,
})

function Page() {
  const { state } = Route.useSearch()
  return <ReleaseList state={state ?? 'open'} />
}
