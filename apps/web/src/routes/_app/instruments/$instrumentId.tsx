import { createFileRoute } from '@tanstack/react-router'

import { InstrumentDetailPage } from '@/features/instruments/detail'

export const Route = createFileRoute('/_app/instruments/$instrumentId')({
  staticData: { title: 'Instrument' },
  component: Page,
})

function Page() {
  const { instrumentId } = Route.useParams()
  return <InstrumentDetailPage id={Number(instrumentId)} />
}
