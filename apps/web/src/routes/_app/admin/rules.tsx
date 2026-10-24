import { createFileRoute } from '@tanstack/react-router'

import { PendingPage } from '@/components/shell/pending-page'

export const Route = createFileRoute('/_app/admin/rules')({
  staticData: { title: 'Rules' },
  component: () => <PendingPage title="Rules" step={9} />,
})
