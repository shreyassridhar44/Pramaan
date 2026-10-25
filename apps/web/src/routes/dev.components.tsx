import { createFileRoute, notFound } from '@tanstack/react-router'

import { ComponentGallery } from '@/features/dev/component-gallery'

/** Component gallery for development builds; production builds answer not found. */
export const Route = createFileRoute('/dev/components')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: ComponentGallery,
})
