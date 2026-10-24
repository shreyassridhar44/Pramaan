import { createFileRoute } from '@tanstack/react-router'

import { SubmitWizard } from '@/features/portal/submit-wizard'

export const Route = createFileRoute('/portal/submit')({
  validateSearch: (s: Record<string, unknown>): { demand?: number } => ({
    demand:
      Number.isFinite(Number(s.demand)) && s.demand !== undefined ? Number(s.demand) : undefined,
  }),
  component: Page,
})

function Page() {
  const { demand } = Route.useSearch()
  return <SubmitWizard demandId={demand} />
}
