import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Chip } from '@/components/signature/chips'
import { Button } from '@/components/ui/button'
import { ErrorState, Panel, PanelHeader, Skeleton } from '@/components/ui/primitives'
import { ApiError, api, unwrap } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { todayIso } from '@/lib/asof'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useMe } from '@/lib/session'

type Rule = components['schemas']['RuleOut']
type Params = Record<string, unknown>

const LABEL: Record<string, string> = {
  rate_card_lakh: 'Rate card (Rs lakh per programme level)',
  leased_multiplier: 'Multiplier for leased premises',
  exempt_existing_years: 'Existing institutions exempt for (years)',
  term_years: 'Term of the deposit (years)',
  furnish_within_days: 'Furnish within (days of intimation)',
  slabs: 'Late penalties',
  reminder_offsets_days: 'Reminders before maturity (days)',
  overdue_reminder_every_days: 'Repeat overdue reminders every (days)',
  maturing_window_days: 'Maturing window (days)',
  reconfirm_window_days: 'Re-confirm with the bank every (days)',
  ladder: 'Escalation ladder',
  premature_encashment: 'Premature encashment penalty',
  closure_incomplete: 'Closure without completing obligations',
  closure_not_applied_six_years: 'Closure not applied for within six years',
  required_documents: 'Documents required for release',
  required_cells: 'Clearances required for release',
}
const DISCIPLINE: Record<string, string> = {
  engineering_technology: 'Engineering and Technology',
  planning: 'Planning',
  applied_arts_crafts: 'Applied Arts and Crafts',
  design: 'Design',
  hmct: 'Hotel Management',
  computer_applications: 'Computer Applications',
  management: 'Management',
}
const LEVELS = ['dealing_officer', 'section_head', 'deputy_director', 'director']
const OPTIONS: Record<string, string[]> = {
  required_documents: ['application_letter', 'affidavit_6', 'instrument_copy', 'latest_loa_eoa'],
  required_cells: ['pgrc', 'vigilance', 'grants'],
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NAMES: Record<string, string> = {
  pgrc: 'PGRC',
  vigilance: 'Vigilance Cell',
  grants: 'Grants bureaus',
  application_letter: 'Application letter',
  affidavit_6: 'Affidavit 6',
  instrument_copy: 'Copy of the FDR or payment proof',
  latest_loa_eoa: 'Latest LoA or EoA',
}
const words = (s: string) => NAMES[s] ?? s.replaceAll('_', ' ')
const ORDER = Object.keys(LABEL)
const isFraction = (k: string) =>
  ['premature_encashment', 'closure_incomplete', 'closure_not_applied_six_years'].includes(k)

/** Read-only rendering of a parameter value. */
function Show({ k, v }: { k: string; v: unknown }) {
  if (k === 'rate_card_lakh') {
    const card = v as Record<string, Record<string, number | null>>
    return (
      <table className="mt-1 w-full max-w-lg text-[0.8125rem]">
        <thead>
          <tr className="text-left text-[0.6875rem] text-ink-3 uppercase">
            <th className="py-1 font-medium">Discipline</th>
            <th className="py-1 text-right font-medium">Diploma</th>
            <th className="py-1 text-right font-medium">UG</th>
            <th className="py-1 text-right font-medium">PG</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(card).map(([d, levels]) => (
            <tr key={d} className="border-t border-line">
              <td className="py-1 text-ink-2">{DISCIPLINE[d] ?? words(d)}</td>
              {['diploma', 'ug', 'pg'].map((l) => (
                <td key={l} className="py-1 text-right font-mono">
                  {levels[l] ?? 'n/a'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  if (k === 'slabs')
    return (
      <span className="font-mono">
        {(v as [[number, number], number][])
          .map(([[m, d], f]) => `${Math.round(f * 100)}% up to ${d} ${MONTHS[m - 1]}`)
          .join('; ')}
      </span>
    )
  if (k === 'ladder')
    return (
      <span className="font-mono">
        {(v as [number, string][]).map(([d, l]) => `day ${d}: ${words(l)}`).join('; ')}
      </span>
    )
  if (Array.isArray(v))
    return <span className="font-mono">{v.map((x) => words(String(x))).join(', ')}</span>
  if (isFraction(k)) return <span className="font-mono">{Math.round(Number(v) * 100)}%</span>
  return <span className="font-mono">{String(v)}</span>
}

const input =
  'h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[0.8125rem] text-ink focus-visible:border-accent focus-visible:outline-none'

/** Editor for one parameter; edits a draft copy of the rule's parameters. */
function Edit({ k, v, set }: { k: string; v: unknown; set: (v: unknown) => void }) {
  if (k === 'rate_card_lakh') {
    const card = v as Record<string, Record<string, number | null>>
    return (
      <table className="mt-1 w-full max-w-lg text-[0.8125rem]">
        <tbody>
          {Object.entries(card).map(([d, levels]) => (
            <tr key={d} className="border-t border-line">
              <td className="py-1 text-ink-2">{DISCIPLINE[d] ?? words(d)}</td>
              {['diploma', 'ug', 'pg'].map((l) => (
                <td key={l} className="py-1 pl-2">
                  <input
                    aria-label={`${DISCIPLINE[d] ?? d} ${l}`}
                    className={cn(input, 'w-16 text-right font-mono')}
                    value={levels[l] ?? ''}
                    placeholder="n/a"
                    inputMode="numeric"
                    onChange={(e) =>
                      set({
                        ...card,
                        [d]: {
                          ...levels,
                          [l]: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  if (k === 'reminder_offsets_days') {
    const list = v as number[]
    return <OffsetChips list={list} set={set} />
  }
  if (k === 'ladder') {
    const rows = v as [number, string][]
    return (
      <div className="grid gap-1.5">
        {rows.map(([d, level], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[0.75rem] text-ink-3">Day</span>
            <input
              aria-label="Days overdue"
              className={cn(input, 'w-16 font-mono')}
              value={d}
              inputMode="numeric"
              disabled={i === 0}
              onChange={(e) =>
                set(rows.map((r, j) => (j === i ? [Number(e.target.value), r[1]] : r)))
              }
            />
            <select
              aria-label="Escalation level"
              className={input}
              value={level}
              onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {words(l)}
                </option>
              ))}
            </select>
            {i > 0 ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove step"
                onClick={() => set(rows.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="w-fit"
          onClick={() => set([...rows, [(rows.at(-1)?.[0] ?? 0) + 30, 'director']])}
        >
          <Plus /> Add step
        </Button>
      </div>
    )
  }
  if (k === 'slabs') {
    const rows = v as [[number, number], number][]
    return (
      <div className="grid gap-1.5">
        {rows.map(([[m, d], f], i) => (
          <div key={i} className="flex items-center gap-2 text-[0.8125rem]">
            <input
              aria-label="Penalty percent"
              className={cn(input, 'w-14 text-right font-mono')}
              value={Math.round(f * 100)}
              inputMode="numeric"
              onChange={(e) =>
                set(rows.map((r, j) => (j === i ? [r[0], Number(e.target.value) / 100] : r)))
              }
            />
            % up to
            <input
              aria-label="Day"
              className={cn(input, 'w-12 text-right font-mono')}
              value={d}
              inputMode="numeric"
              onChange={(e) =>
                set(rows.map((r, j) => (j === i ? [[r[0][0], Number(e.target.value)], r[1]] : r)))
              }
            />
            <select
              aria-label="Month"
              className={input}
              value={m}
              onChange={(e) =>
                set(rows.map((r, j) => (j === i ? [[Number(e.target.value), r[0][1]], r[1]] : r)))
              }
            >
              {MONTHS.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    )
  }
  if (OPTIONS[k]) {
    const chosen = new Set(v as string[])
    return (
      <div className="flex flex-wrap gap-3">
        {OPTIONS[k]!.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-[0.8125rem] text-ink">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={chosen.has(o)}
              onChange={(e) =>
                set(OPTIONS[k]!.filter((x) => (x === o ? e.target.checked : chosen.has(x))))
              }
            />
            {words(o)}
          </label>
        ))}
      </div>
    )
  }
  if (isFraction(k))
    return (
      <span className="flex items-center gap-1 text-[0.8125rem]">
        <input
          aria-label={LABEL[k] ?? k}
          className={cn(input, 'w-16 text-right font-mono')}
          value={Math.round(Number(v) * 100)}
          inputMode="numeric"
          onChange={(e) => set(Number(e.target.value) / 100)}
        />
        %
      </span>
    )
  return (
    <input
      aria-label={LABEL[k] ?? k}
      className={cn(input, 'w-20 text-right font-mono')}
      value={String(v)}
      inputMode="numeric"
      onChange={(e) => set(Number(e.target.value))}
    />
  )
}

function OffsetChips({ list, set }: { list: number[]; set: (v: unknown) => void }) {
  const [add, setAdd] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...list]
        .sort((a, b) => b - a)
        .map((d) => (
          <span
            key={d}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft pr-1 pl-3 font-mono text-[0.8125rem]"
          >
            T-{d}
            <button
              type="button"
              className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
              aria-label={`Remove T-${d}`}
              onClick={() => set(list.filter((x) => x !== d))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number(add)
          if (Number.isInteger(n) && n >= 0 && !list.includes(n)) set([...list, n])
          setAdd('')
        }}
      >
        <input
          aria-label="Add a reminder offset in days"
          className={cn(input, 'w-16 font-mono')}
          value={add}
          placeholder="days"
          inputMode="numeric"
          onChange={(e) => setAdd(e.target.value)}
        />
        <Button size="sm" variant="ghost" type="submit">
          <Plus /> Add
        </Button>
      </form>
    </div>
  )
}

function RuleCard({ rule, canEdit }: { rule: Rule; canEdit: boolean }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Params | null>(null)
  const [effective, setEffective] = useState(todayIso())
  const [note, setNote] = useState('')
  const [history, setHistory] = useState(false)
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/rules/{code}/versions', {
          params: { path: { code: rule.code } },
          body: { params: draft!, effective_from: effective, note: note.trim() },
        }),
      ),
    onSuccess: () => {
      toast.success('New rule version saved. The previous version stays in the history.')
      setDraft(null)
      setNote('')
      void qc.invalidateQueries()
    },
    onError: (e) => toast.error((e as ApiError).message),
  })
  const params = (draft ?? rule.current.params) as Params
  return (
    <Panel role="region" aria-label={rule.title}>
      <PanelHeader
        title={rule.title}
        caption={`Version ${rule.current.version}, in force from ${formatDate(rule.current.effective_from)}${rule.current.created_by ? `, set by ${rule.current.created_by}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={rule.is_assumption ? 'due' : 'neutral'}>
              {rule.is_assumption ? 'Team assumption' : rule.aph_ref}
            </Chip>
            {rule.history.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistory((h) => !h)}
                aria-expanded={history}
              >
                <History /> {rule.history.length} versions
              </Button>
            ) : null}
            {canEdit && !draft ? (
              <Button
                size="sm"
                onClick={() => setDraft(structuredClone(rule.current.params) as Params)}
              >
                <Pencil /> Change
              </Button>
            ) : null}
          </div>
        }
      />
      <dl className="grid gap-3 px-5 pb-5">
        {Object.entries(params)
          .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
          .map(([k, v]) => (
            <div key={k} className="grid gap-1 sm:grid-cols-[260px_1fr] sm:items-start">
              <dt className="text-[0.8125rem] text-ink-3">{LABEL[k] ?? words(k)}</dt>
              <dd className="text-[0.8125rem] text-ink">
                {draft ? (
                  <Edit k={k} v={v} set={(nv) => setDraft({ ...draft, [k]: nv })} />
                ) : (
                  <Show k={k} v={v} />
                )}
              </dd>
            </div>
          ))}
      </dl>
      {draft ? (
        <div className="grid gap-3 border-t border-line bg-sunken/40 px-5 py-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-[0.8125rem] text-ink-2">
            In force from
            <input
              type="date"
              min={todayIso()}
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
              className={input}
            />
          </label>
          <label className="grid gap-1 text-[0.8125rem] text-ink-2">
            Reason for the change
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: AICTE notification of 12 Jan 2027"
              className={cn(input, 'w-full')}
            />
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={note.trim().length < 5 || save.isPending}
              onClick={() => save.mutate()}
            >
              Save as version {Math.max(...rule.history.map((h) => h.version)) + 1}
            </Button>
          </div>
        </div>
      ) : null}
      {history ? (
        <ol className="border-t border-line px-5 py-3">
          {rule.history.map((h) => (
            <li key={h.version} className="flex flex-wrap gap-x-4 py-1.5 text-[0.8125rem]">
              <span className="font-mono text-ink">v{h.version}</span>
              <span className="text-ink-2">from {formatDate(h.effective_from)}</span>
              <span className="text-ink-3">{h.created_by ?? 'Seeded from the APH'}</span>
              {h.note ? <span className="text-ink-2">{h.note}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  )
}

/** Rules administration (PROTOTYPE.md 5.13): every rule with its APH clause and versions. */
export function RulesPage() {
  const me = useMe().data
  const canEdit = !!me && ['admin', 'section_head'].includes(me.role)
  const q = useQuery({
    queryKey: ['rules'],
    queryFn: async () => unwrap(await api.GET('/api/v1/rules')),
  })
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Panel>
    )
  if (!q.data)
    return (
      <div className="grid gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    )
  return (
    <div className="grid gap-5">
      <p className="max-w-3xl text-[0.875rem] text-ink-2">
        Rules come from the Approval Process Handbook 2024-27 or are marked as team assumptions. A
        change creates a new version from a chosen date; earlier versions stay in force for earlier
        dates and in the history.{' '}
        {canEdit ? '' : 'Only the section head and administrators can change rules.'}
      </p>
      {q.data.map((r) => (
        <RuleCard key={r.code} rule={r} canEdit={canEdit} />
      ))}
    </div>
  )
}
