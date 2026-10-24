import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/forecast')({
  staticData: { title: 'Forecast' },
  component: () => <PendingPage title="Forecast" step={9} />,
})
