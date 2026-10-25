import { createFileRoute } from '@tanstack/react-router'

import { LettersPage } from '@/features/releases/letters-page'

export const Route = createFileRoute('/_app/letters')({
  staticData: { title: 'Letters' },
  component: LettersPage,
})
