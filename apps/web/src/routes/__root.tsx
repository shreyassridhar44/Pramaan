import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { TooltipProvider } from '@/components/ui/primitives'
import { TourOverlay } from '@/features/tour/tour-overlay'

export interface RouterContext {
  queryClient: QueryClient
}

type RootSearch = { asOf?: string }

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: (search: Record<string, unknown>): RootSearch => {
    const v = search.asOf
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? { asOf: v } : {}
  },
  component: Root,
})

function Root() {
  return (
    <TooltipProvider>
      <Outlet />
      <TourOverlay />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            '!rounded-[var(--radius-panel)] !border !border-line !bg-surface !text-ink !shadow-[var(--shadow-overlay)]',
        }}
      />
    </TooltipProvider>
  )
}
