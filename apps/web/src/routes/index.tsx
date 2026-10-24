import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { api, unwrap } from '@/lib/api/client'

export const Route = createFileRoute('/')({
  component: Placeholder,
})

/** Step 1 placeholder: proves the web app, proxy and API are wired together. Replaced in Step 4. */
function Placeholder() {
  const health = useQuery({
    queryKey: ['healthz'],
    queryFn: async () => unwrap(await api.GET('/api/v1/healthz')),
  })

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="text-xs font-medium tracking-[0.04em] text-ink-3 uppercase">
        AICTE Regulation Bureau
      </p>
      <h1 className="font-display text-6xl leading-[1.05] tracking-[-0.01em]">Pramaan</h1>
      <p className="text-base text-ink-2">Security deposits and FDRs, proven at source.</p>
      <p className="font-mono text-sm text-ink-3" role="status">
        API:{' '}
        {health.isPending
          ? 'checking'
          : health.isError
            ? 'unreachable'
            : `${health.data.status} (${health.data.environment})`}
      </p>
    </main>
  )
}
