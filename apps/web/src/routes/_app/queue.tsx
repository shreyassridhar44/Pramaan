import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/queue')({
  staticData: { title: 'Verification queue' },
  component: () => <PendingPage title="Verification queue" step={6} />,
})
