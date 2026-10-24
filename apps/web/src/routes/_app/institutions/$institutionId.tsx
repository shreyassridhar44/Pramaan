import { createFileRoute } from '@tanstack/react-router'

import { InstitutionProfile } from '@/features/institutions/institutions'

export const Route = createFileRoute('/_app/institutions/$institutionId')({
  staticData: { title: 'Institution' },
  component: Page,
})

function Page() {
  const { institutionId } = Route.useParams()
  return <InstitutionProfile id={Number(institutionId)} />
}
