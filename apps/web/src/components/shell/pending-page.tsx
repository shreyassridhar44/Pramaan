import { Hammer } from 'lucide-react'

import { EmptyState, Panel } from '@/components/ui/primitives'

/** Temporary page for a screen whose implementation step has not been reached yet. */
export function PendingPage({ title, step }: { title: string; step: number }) {
  return (
    <Panel>
      <EmptyState
        icon={<Hammer />}
        title={`${title} is built in step ${step}`}
        body="This screen is part of the implementation plan in claude-code/STEPS.md."
      />
    </Panel>
  )
}
