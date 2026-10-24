import { createFileRoute } from '@tanstack/react-router'

import { CommandView } from '@/features/command/command-view'

export const Route = createFileRoute('/_app/')({
  staticData: { title: 'Command' },
  component: CommandView,
})
