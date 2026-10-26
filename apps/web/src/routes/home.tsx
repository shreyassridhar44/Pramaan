import { createFileRoute } from '@tanstack/react-router'

import { useEffect } from 'react'

import { HomePage } from '@/features/home/home-page'
import { tour } from '@/features/tour/store'

export const Route = createFileRoute('/home')({
  validateSearch: (search: Record<string, unknown>): { tour?: number } =>
    search.tour ? { tour: 1 } : {},
  component: Home,
})

/** `/home?tour=1` starts the guided tour, so the link can be shared with evaluators. */
function Home() {
  const { tour: start } = Route.useSearch()
  useEffect(() => {
    if (start) tour.start()
  }, [start])
  return <HomePage />
}
