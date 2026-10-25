import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { CaseView } from '@/features/releases/case-view'

export const Route = createFileRoute('/_app/releases/$caseId')({
  staticData: { title: 'Release case' },
  component: Page,
})

function Page() {
  const { caseId } = Route.useParams()
  return (
    <div className="grid gap-5">
      <Link
        to="/releases"
        className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Releases
      </Link>
      <CaseView id={Number(caseId)} mode="officer" />
    </div>
  )
}
