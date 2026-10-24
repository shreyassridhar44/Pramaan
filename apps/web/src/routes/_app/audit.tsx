import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/audit')({
  staticData: { title: 'Audit' },
  component: () => <PendingPage title="Audit" step={5} />,
})
