import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ApiError, api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

import type { RegistrySearch } from './registry'

type Result = components['schemas']['InterpretResult']
type ChipT = components['schemas']['Chip']

const EXAMPLES = [
  'Unconfirmed deposits in the Western region maturing before March 2027',
  'Matured deposits with signals in the North-East',
  'Pending verification at Bharat National Bank',
]

/** Turns chips the officer kept into registry search parameters. */
function toSearch(chips: ChipT[], keep: RegistrySearch): RegistrySearch {
  const list = (key: string) => chips.filter((c) => c.key === key).map((c) => c.value)
  const one = (key: string) => chips.find((c) => c.key === key)?.value
  const signals = one('has_signals')
  return {
    sort: keep.sort,
    q: one('q'),
    region: list('region').length ? list('region') : undefined,
    bank: list('bank').length ? list('bank') : undefined,
    kind: list('kind').length ? list('kind') : undefined,
    status: list('status').length ? list('status') : undefined,
    assurance: list('assurance').length ? list('assurance').map(Number) : undefined,
    maturity_from: one('maturity_from'),
    maturity_to: one('maturity_to'),
    has_signals: signals === undefined ? undefined : signals === 'true',
  }
}

/**
 * Plain-language search (PROTOTYPE.md 5.4). The interpretation is shown as chips that the officer
 * can remove before applying; nothing is applied unseen.
 */
export function AskBar({
  search,
  onApply,
}: {
  search: RegistrySearch
  onApply: (s: RegistrySearch) => void
}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [chips, setChips] = useState<ChipT[]>([])
  const ask = useMutation({
    mutationFn: async (t: string) =>
      unwrap(await api.POST('/api/v1/search/interpret', { body: { text: t } })),
    onSuccess: (r) => {
      setResult(r)
      setChips(r.chips)
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  const submit = (t: string) => {
    setText(t)
    if (t.trim()) ask.mutate(t.trim())
  }
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
      >
        <Sparkles className="ml-1 size-4 shrink-0 text-accent" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask in plain English, for example: unconfirmed deposits in Kerala maturing in the next 90 days"
          aria-label="Ask in plain English"
          className="h-9 min-w-0 flex-1 bg-transparent text-[0.875rem] text-ink placeholder:text-ink-3 focus-visible:outline-none"
        />
        <Button type="submit" size="sm" variant="primary" disabled={!text.trim() || ask.isPending}>
          {ask.isPending ? <Loader2 className="animate-spin" /> : null} Interpret
        </Button>
      </form>
      {!result ? (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-line px-2.5 py-0.5 text-[0.75rem] text-ink-3 hover:border-line-strong hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {result ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-line pt-3 pl-7">
              <p className="text-[0.75rem] text-ink-3">
                {result.source === 'model'
                  ? 'Interpreted by AI, check before use.'
                  : 'Interpreted by rules, check before use.'}
                {result.note ? ` ${result.note}` : ''}
              </p>
              {chips.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Interpreted filters">
                  {chips.map((c) => (
                    <li
                      key={`${c.key}-${c.value}`}
                      className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft pr-1 pl-3 text-[0.8125rem] text-ink"
                    >
                      {c.label}
                      <button
                        type="button"
                        onClick={() => setChips((cs) => cs.filter((x) => x !== c))}
                        className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
                        aria-label={`Remove ${c.label}`}
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[0.8125rem] text-ink-2">
                  No filters could be read from this request.
                </p>
              )}
              {result.unrecognised.length ? (
                <p className="mt-2 text-[0.75rem] text-due">
                  Not understood: {result.unrecognised.join(', ')}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!chips.length}
                  onClick={() => {
                    onApply(toSearch(chips, search))
                    setResult(null)
                  }}
                >
                  <Check /> Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
