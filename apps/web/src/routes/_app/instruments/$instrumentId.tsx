import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/instruments/$instrumentId')({
  staticData: { title: 'Instrument' },
  component: () => <PendingPage title="Instrument" step={5} />,
})
