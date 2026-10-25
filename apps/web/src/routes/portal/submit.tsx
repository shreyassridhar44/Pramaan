import { createFileRoute } from '@tanstack/react-router'

import { SubmitWizard } from '@/features/portal/submit-wizard'

export const Route = createFileRoute('/portal/submit')({
  validateSearch: (s: Record<string, unknown>): { demand?: number; renew?: number } => ({
    demand: toId(s.demand),
    renew: toId(s.renew),
  }),
  component: Page,
})

function toId(v: unknown): number | undefined {
  return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined
}

function Page() {
  const { demand, renew } = Route.useSearch()
  return <SubmitWizard demandId={demand} renewId={renew} />
}
