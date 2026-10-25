import { createFileRoute } from '@tanstack/react-router'

import { RulesPage } from '@/features/admin/rules-page'

export const Route = createFileRoute('/_app/admin/rules')({
  staticData: { title: 'Rules' },
  component: RulesPage,
})
