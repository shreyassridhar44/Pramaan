import { createFileRoute } from '@tanstack/react-router'

import { LegacyImportPage } from '@/features/legacy/legacy-page'

export const Route = createFileRoute('/_app/admin/import')({
  staticData: { title: 'Legacy import' },
  component: LegacyImportPage,
})
