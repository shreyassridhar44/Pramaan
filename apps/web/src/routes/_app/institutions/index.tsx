import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/institutions/')({
  staticData: { title: 'Institutions' },
  component: () => <PendingPage title="Institutions" step={5} />,
})
