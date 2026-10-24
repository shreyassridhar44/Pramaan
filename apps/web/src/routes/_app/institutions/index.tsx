import { createFileRoute } from '@tanstack/react-router'

import { InstitutionsList } from '@/features/institutions/institutions'

export const Route = createFileRoute('/_app/institutions/')({
  staticData: { title: 'Institutions' },
  component: InstitutionsList,
})
