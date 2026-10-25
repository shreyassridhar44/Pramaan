import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { PortalReleases } from '@/features/portal/release-form'
import { CaseView } from '@/features/releases/case-view'

export const Route = createFileRoute('/portal/release')({
  validateSearch: (s: Record<string, unknown>): { case?: number } => ({
    case: s.case !== undefined && Number.isFinite(Number(s.case)) ? Number(s.case) : undefined,
  }),
  component: Page,
})

function Page() {
  const { case: caseId } = Route.useSearch()
  if (!caseId) return <PortalReleases />
  return (
    <div className="grid gap-5">
      <Link
        to="/portal/release"
        className="inline-flex w-fit items-center gap-1.5 text-[0.875rem] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Release
      </Link>
      <CaseView id={caseId} mode="portal" />
    </div>
  )
}
