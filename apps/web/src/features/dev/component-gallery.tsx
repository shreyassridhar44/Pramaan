import { Download, Inbox, Send } from 'lucide-react'
import type { ReactNode } from 'react'

import { AssuranceRing } from '@/components/signature/assurance'
import { ASSURANCE, type AssuranceLevel } from '@/components/signature/assurance-meta'
import {
  Amount,
  Chip,
  SeverityChip,
  SimulatedBadge,
  StatusChip,
} from '@/components/signature/chips'
import { ClearanceLanes } from '@/components/signature/clearance-lanes'
import { PramaanMark, Wordmark } from '@/components/signature/mark'
import { STATUS } from '@/components/signature/status-meta'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  Input,
  Kbd,
  Label,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { useTheme } from '@/lib/theme'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">{children}</div>
    </Panel>
  )
}

/** Every shared component in its states, in the current theme. Development builds only. */
export function ComponentGallery() {
  const { theme, toggle } = useTheme()
  return (
    <main className="mx-auto grid max-w-[1200px] gap-5 bg-canvas px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PramaanMark />
          <Wordmark />
          <Chip tone="simulated">Development only</Chip>
        </div>
        <Button size="sm" onClick={toggle}>
          Switch to {theme === 'command' ? 'Ledger (light)' : 'Command (dark)'}
        </Button>
      </header>
      <Section title="Buttons">
        {(['primary', 'secondary', 'ghost', 'danger', 'link'] as const).map((v) => (
          <Button key={v} variant={v}>
            <Send /> {v}
          </Button>
        ))}
        <Button size="sm">Small</Button>
        <Button size="lg" variant="primary">
          Large
        </Button>
        <Button size="icon" aria-label="Download">
          <Download />
        </Button>
        <Button disabled>Disabled</Button>
      </Section>
      <Section title="Chips">
        {(['neutral', 'info', 'ok', 'due', 'overdue', 'simulated', 'brand'] as const).map((t) => (
          <Chip key={t} tone={t} dot>
            {t}
          </Chip>
        ))}
        <SimulatedBadge />
        {['low', 'medium', 'high'].map((s) => (
          <SeverityChip key={s} severity={s} />
        ))}
      </Section>
      <Section title="Instrument statuses">
        {Object.keys(STATUS).map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </Section>
      <Section title="Assurance levels">
        {([0, 1, 2, 3] as AssuranceLevel[]).map((l) => (
          <span key={l} className="inline-flex items-center gap-2 text-[0.8125rem] text-ink-2">
            <AssuranceRing level={l} size={28} /> {ASSURANCE[l].name}
          </span>
        ))}
      </Section>
      <Section title="Amounts and text">
        <Amount paise="1234567800" />
        <Amount paise="1234567800" compact />
        <Label>Label</Label>
        <Kbd>Ctrl K</Kbd>
        <Input placeholder="Input" aria-label="Sample input" className="w-60" />
        <Skeleton className="h-6 w-40" />
      </Section>
      <Section title="Clearance lanes">
        <div className="w-full">
          <ClearanceLanes
            authority="Member Secretary"
            authorisation="waiting"
            discharge="idle"
            lanes={[
              {
                cell: 'pgrc',
                label: 'PGRC',
                status: 'cleared',
                officer: 'PGRC officer',
                reason: 'No open grievance.',
                decided_on: '2026-10-20',
              },
              {
                cell: 'vigilance',
                label: 'Vigilance',
                status: 'blocked',
                officer: 'Vigilance officer',
                reason: 'Inquiry pending.',
                decided_on: '2026-10-21',
              },
              { cell: 'grants', label: 'Grants', status: 'pending', hint: 'Awaiting review' },
            ]}
          />
        </div>
      </Section>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <EmptyState
            icon={<Inbox />}
            title="Empty state"
            body="What to do next."
            action={<Button size="sm">Action</Button>}
          />
        </Panel>
        <Panel>
          <ErrorState
            error={{ message: 'Sample failure.', requestId: 'req-0001' }}
            onRetry={() => undefined}
          />
        </Panel>
      </div>
    </main>
  )
}
