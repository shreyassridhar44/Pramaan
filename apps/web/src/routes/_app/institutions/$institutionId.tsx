import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/institutions/$institutionId')({
  staticData: { title: 'Institution' },
  component: () => <PendingPage title="Institution" step={5} />,
})
