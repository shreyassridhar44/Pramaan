import { createFileRoute } from '@tanstack/react-router'

import { QueuePage } from '@/features/queue/queue-page'

export const Route = createFileRoute('/_app/queue')({
  staticData: { title: 'Verification queue' },
  component: QueuePage,
})
