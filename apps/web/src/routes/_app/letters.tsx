import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/letters')({
  staticData: { title: 'Letters' },
  component: () => <PendingPage title="Letters" step={8} />,
})
