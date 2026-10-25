import { render, screen } from '@testing-library/react'
import axe from 'axe-core'

import { TooltipProvider } from '@/components/ui/primitives'

import { AssuranceLabel, AssuranceRing } from './assurance'
import { Amount, SimulatedBadge, StatusChip } from './chips'
import { ClearanceLanes } from './clearance-lanes'

async function expectNoSeriousViolations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { region: { enabled: false } } })
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(serious.map((v) => v.id)).toEqual([])
}

describe('AssuranceRing', () => {
  it.each([0, 1, 2, 3] as const)('labels level %s for assistive technology', async (level) => {
    const { container } = render(
      <TooltipProvider>
        <AssuranceRing level={level} size={40} />
      </TooltipProvider>,
    )
    expect(screen.getByRole('img')).toHaveAccessibleName(/Assurance A\d/)
    await expectNoSeriousViolations(container)
  })

  it('shows the level name next to the ring in the label variant', () => {
    render(
      <TooltipProvider>
        <AssuranceLabel level={2} />
      </TooltipProvider>,
    )
    expect(screen.getByText('Bank-confirmed')).toBeInTheDocument()
  })
})

describe('chips', () => {
  it('uses words, not only colour, for status', async () => {
    const { container } = render(<StatusChip status="discrepancy" />)
    expect(screen.getByText('Discrepancy')).toBeInTheDocument()
    await expectNoSeriousViolations(container)
  })

  it('labels simulated surfaces', () => {
    render(<SimulatedBadge />)
    expect(screen.getByText('Simulated bank')).toBeInTheDocument()
  })

  it('formats amounts in Indian notation', () => {
    render(<Amount paise="350000000" />)
    expect(screen.getByText('₹35,00,000')).toBeInTheDocument()
  })
})

describe('ClearanceLanes', () => {
  const lanes = [
    { cell: 'pgrc', label: 'PGRC', status: 'pending', hint: '1 open complaint to resolve' },
    {
      cell: 'vigilance',
      label: 'Vigilance Cell',
      status: 'cleared',
      officer: 'Harish Negi',
      decided_on: '2026-10-18',
      reason: 'No objection',
    },
    {
      cell: 'grants',
      label: 'Grants bureaus',
      status: 'blocked',
      officer: 'Meera Pillai',
      decided_on: '2026-10-19',
      reason: 'Utilisation certificate outstanding',
    },
  ]

  it('states every lane in words, with the reason for a block', async () => {
    const { container } = render(
      <ClearanceLanes
        lanes={lanes}
        authorisation="blocked"
        discharge="idle"
        authority="NOC by the Approval Bureau"
      />,
    )
    expect(screen.getByText('Awaiting')).toBeInTheDocument()
    expect(screen.getByText('Cleared')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('Utilisation certificate outstanding')).toBeInTheDocument()
    expect(screen.getByText('1 open complaint to resolve')).toBeInTheDocument()
    expect(screen.getByText(/Blocked until the cell lifts/)).toBeInTheDocument()
    await expectNoSeriousViolations(container)
  })
})
