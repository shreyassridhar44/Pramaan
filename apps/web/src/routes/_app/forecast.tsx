import { createFileRoute } from '@tanstack/react-router'

import { ForecastPage } from '@/features/forecast/forecast-page'

export const Route = createFileRoute('/_app/forecast')({
  staticData: { title: 'Forecast' },
  component: ForecastPage,
})
