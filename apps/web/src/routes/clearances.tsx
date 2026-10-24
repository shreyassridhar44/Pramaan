import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/clearances')({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PendingPage title="Clearance queue" step={8} />
    </div>
  ),
})
