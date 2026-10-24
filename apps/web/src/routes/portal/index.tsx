import { createFileRoute } from '@tanstack/react-router'

import { PortalHome } from '@/features/portal/home'

export const Route = createFileRoute('/portal/')({
  component: PortalHome,
})
