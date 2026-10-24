import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/instruments/')({
  staticData: { title: 'Instruments' },
  component: () => <PendingPage title="Instruments" step={5} />,
})
