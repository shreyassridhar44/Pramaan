import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/portal/letters')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/portal/letters"!</div>
}
