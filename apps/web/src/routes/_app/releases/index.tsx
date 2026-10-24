import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/releases/')({
  staticData: { title: 'Releases' },
  component: () => <PendingPage title="Releases" step={8} />,
})
