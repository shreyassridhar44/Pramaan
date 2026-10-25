import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileUp,
  FlaskConical,
  Loader2,
  ScanSearch,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { DocumentViewer } from '@/components/signature/document-viewer'
import { Button } from '@/components/ui/button'
import { ErrorState, Input, Label, Panel } from '@/components/ui/primitives'
import { useMeta } from '@/features/instruments/queries'
import { ApiError, api, unwrap } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/upload'
import { cn } from '@/lib/cn'
import { formatDate, formatINR } from '@/lib/format'
import { useMe } from '@/lib/session'

import { usePortalHome } from './queries'

type Analysis = {
  document_id: number
  analysed: boolean
  width?: number
  height?: number
  page_url?: string
  heatmap_url?: string
  fields?: {
    field: string
    label: string
    value: string
    display: string
    norm: string | null
    box: number[]
    confidence: number
  }[]
  checks?: { code: string; severity: string; title: string; detail: string; field: string | null }[]
  forensics?: { score: number; method: string; regions: { box: number[]; score: number }[] }
  model_versions?: Record<string, string>
  duration_ms?: number
}

type Form = {
  kind: string
  bank_code: string
  branch: string
  ifsc: string
  number: string
  amount_rupees: string
  issue_date: string
  maturity_date: string
  holders: string
  lien: boolean
}

const STEPS = [
  'Deposit details',
  'Upload the receipt',
  'Affidavit and declaration',
  'Review and submit',
]
const DRAFT_KEY = 'pramaan.portal.draft'

function plusYears(iso: string, years: number) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

export function SubmitWizard({ demandId, renewId }: { demandId?: number; renewId?: number }) {
  const home = usePortalHome()
  // Held here so the confirmation survives the home refetch that closes the demand.
  const [submitted, setSubmitted] = useState<{ id: number; signals: number } | null>(null)
  if (submitted) return <Submitted id={submitted.id} signals={submitted.signals} />
  if (home.isPending)
    return (
      <Panel className="p-8">
        <Loader2 className="size-5 animate-spin text-ink-3" />
      </Panel>
    )
  if (home.isError)
    return (
      <Panel>
        <ErrorState error={home.error} />
      </Panel>
    )
  if (renewId) {
    const prev = home.data.instruments.find((i) => i.id === renewId && i.can_renew)
    if (prev)
      return <Wizard renewal={prev} trustName={home.data.trust_name} onSubmitted={setSubmitted} />
  }
  const demand = home.data.demands.find((d) => (demandId ? d.id === demandId : d.status === 'open'))
  if (!demand || demand.status !== 'open')
    return (
      <Panel className="p-8">
        <p className="text-[0.9375rem] text-ink">
          There is no open security deposit demand for your institution.
        </p>
        <Link to="/portal" className="mt-3 inline-block text-brand hover:underline">
          Back to home
        </Link>
      </Panel>
    )
  return <Wizard demand={demand} trustName={home.data.trust_name} onSubmitted={setSubmitted} />
}

type HomeT = NonNullable<ReturnType<typeof usePortalHome>['data']>
type DemandT = HomeT['demands'][number]
type HeldT = HomeT['instruments'][number]

function Wizard({
  demand,
  renewal,
  trustName,
  onSubmitted,
}: {
  demand?: DemandT
  renewal?: HeldT
  trustName: string
  onSubmitted: (r: { id: number; signals: number }) => void
}) {
  const draftKey = `${DRAFT_KEY}.${demand ? `d${demand.id}` : `r${renewal?.id}`}`
  const required = demand?.amount_paise ?? renewal?.amount_paise ?? '0'
  const me = useMe().data
  const meta = useMeta()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(() => {
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) return JSON.parse(saved) as Form
    } catch {
      // A missing or unreadable draft just means starting fresh.
    }
    return {
      kind: 'joint_fdr',
      // A renewal is normally booked at the same branch and starts the day the old one matures.
      bank_code: renewal?.bank_code ?? '',
      branch: renewal?.branch ?? '',
      ifsc: renewal?.ifsc ?? '',
      number: '',
      amount_rupees: String(Number(required) / 100),
      issue_date: renewal?.maturity_date ?? '',
      maturity_date: renewal ? plusYears(renewal.maturity_date, 10) : '',
      holders: `Member Secretary, AICTE; Secretary, ${trustName}`,
      lien: true,
    }
  })
  const [scan, setScan] = useState<Analysis | null>(null)
  const [affidavit, setAffidavit] = useState<{ document_id: number; filename: string } | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form))
    } catch {
      // Autosave is a convenience; ignore storage errors.
    }
  }, [form, draftKey])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const declared = {
    number: form.number,
    ifsc: form.ifsc,
    amount: form.amount_rupees,
    issue_date: form.issue_date,
    maturity_date: form.maturity_date,
  }
  const detailsValid =
    form.bank_code &&
    form.branch.length > 1 &&
    /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.ifsc) &&
    form.number.length >= 6 &&
    Number(form.amount_rupees) > 0 &&
    form.issue_date &&
    form.maturity_date > form.issue_date &&
    form.holders.length > 3

  const submit = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/portal/submissions', {
          body: {
            demand_id: demand?.id ?? null,
            predecessor_id: renewal?.id ?? null,
            declared: { ...form, amount_rupees: Number(form.amount_rupees) },
            fdr_document_id: scan!.document_id,
            affidavit_document_id: affidavit!.document_id,
            declaration_accepted: accepted,
          },
        }),
      ),
    onSuccess: (r) => {
      onSubmitted({ id: r.instrument_id, signals: r.signals })
      try {
        localStorage.removeItem(draftKey)
      } catch {
        // Nothing to clean up if storage is unavailable.
      }
      void qc.invalidateQueries({ queryKey: ['portal'] })
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside>
        <Link
          to="/portal"
          className="inline-flex items-center gap-1.5 text-[0.875rem] text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <p lang="hi" className="mt-6 font-deva text-[0.875rem] text-ink-3">
          सुरक्षा जमा प्रस्तुत करें
        </p>
        <h1 className="text-[1.375rem] font-semibold text-ink">
          {renewal ? 'Submit a renewal' : 'Submit a deposit'}
        </h1>
        <p className="mt-1 text-[0.875rem] text-ink-2">
          {demand
            ? `Demand of ${formatINR(demand.amount_paise)}, due ${formatDate(demand.due_on)}.`
            : `Renewal of ${renewal?.number}, ${formatINR(required)}, maturing ${formatDate(renewal!.maturity_date)}.`}
        </p>
        <ol className="mt-6 grid gap-1">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.875rem]',
                i === step ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-[0.75rem] font-semibold',
                  i < step
                    ? 'bg-a2 text-white'
                    : i === step
                      ? 'bg-brand text-brand-contrast'
                      : 'bg-sunken',
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.75rem] text-ink-3">
          Your entries are saved on this device as you type.
        </p>
      </aside>

      <Panel className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            {step === 0 ? (
              <Section
                title="Deposit details"
                hint="Enter the values exactly as printed on the receipt."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type">
                    <select
                      value={form.kind}
                      onChange={(e) => set('kind', e.target.value)}
                      className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[0.9375rem]"
                    >
                      <option value="joint_fdr">Joint FDR in favour of AICTE</option>
                      <option value="rtgs">RTGS to AICTE's account</option>
                    </select>
                  </Field>
                  <Field label="Bank">
                    <select
                      value={form.bank_code}
                      onChange={(e) => set('bank_code', e.target.value)}
                      className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[0.9375rem]"
                    >
                      <option value="">Choose the issuing bank</option>
                      {meta.data?.banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Branch">
                    <Input
                      className="h-10 text-[0.9375rem]"
                      value={form.branch}
                      onChange={(e) => set('branch', e.target.value)}
                      placeholder="Pune Main"
                    />
                  </Field>
                  <Field label="IFSC" hint="11 characters, for example BHNX0411002">
                    <Input
                      className="h-10 font-mono text-[0.9375rem] uppercase"
                      value={form.ifsc}
                      onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
                      maxLength={11}
                    />
                  </Field>
                  <Field label="FDR or receipt number">
                    <Input
                      className="h-10 font-mono text-[0.9375rem]"
                      value={form.number}
                      onChange={(e) => set('number', e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Amount (Rs)"
                    hint={
                      form.amount_rupees ? formatINR(Number(form.amount_rupees) * 100) : undefined
                    }
                  >
                    <Input
                      className="h-10 font-mono text-[0.9375rem]"
                      inputMode="numeric"
                      value={form.amount_rupees}
                      onChange={(e) => set('amount_rupees', e.target.value.replace(/\D/g, ''))}
                    />
                  </Field>
                  <Field label="Issue date">
                    <Input
                      type="date"
                      className="h-10 font-mono"
                      value={form.issue_date}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          issue_date: e.target.value,
                          maturity_date: f.maturity_date || plusYears(e.target.value, 10),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Maturity date" hint="The term is 10 years under the APH">
                    <Input
                      type="date"
                      className="h-10 font-mono"
                      value={form.maturity_date}
                      onChange={(e) => set('maturity_date', e.target.value)}
                    />
                  </Field>
                  <Field label="Holders" className="sm:col-span-2">
                    <Input
                      className="h-10 text-[0.9375rem]"
                      value={form.holders}
                      onChange={(e) => set('holders', e.target.value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2.5 text-[0.9375rem] text-ink sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.lien}
                      onChange={(e) => set('lien', e.target.checked)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    Lien is marked in favour of AICTE, New Delhi
                  </label>
                </div>
                <Nav next={() => setStep(1)} nextDisabled={!detailsValid} />
              </Section>
            ) : step === 1 ? (
              <ReceiptStep
                declared={declared}
                scan={scan}
                setScan={setScan}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                demo={!!me?.demo_mode}
              />
            ) : step === 2 ? (
              <Section
                title="Affidavit 3 and declaration"
                hint="Upload the notarised Affidavit 3 for submitting the security deposit (APH Appendix)."
              >
                <Uploader
                  kind="affidavit_3"
                  label="Affidavit 3 (PDF or image)"
                  onDone={(r) =>
                    setAffidavit({
                      document_id: r.document_id,
                      filename: (r as { filename?: string }).filename ?? 'affidavit',
                    })
                  }
                  done={affidavit?.filename}
                />
                <label className="mt-6 flex items-start gap-3 rounded-[var(--radius-panel)] border border-line bg-sunken/50 p-4 text-[0.9375rem] text-ink">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1 size-4 accent-[var(--brand)]"
                  />
                  <span>
                    I declare that the deposit described here is held in the joint name of AICTE and
                    the trust, that it is not mortgaged or encumbered, and that the values entered
                    match the receipt issued by the bank. I understand that AICTE will confirm these
                    details directly with the bank.
                  </span>
                </label>
                <Nav
                  back={() => setStep(1)}
                  next={() => setStep(3)}
                  nextDisabled={!affidavit || !accepted}
                />
              </Section>
            ) : (
              <Section
                title="Review and submit"
                hint="Check everything once more. After submission AICTE scrutinises the deposit and asks the bank to confirm it."
              >
                <dl className="grid gap-x-8 gap-y-3 text-[0.9375rem] sm:grid-cols-2">
                  {[
                    ['Bank', meta.data?.banks.find((b) => b.code === form.bank_code)?.name],
                    ['Branch and IFSC', `${form.branch}, ${form.ifsc}`],
                    ['Receipt number', form.number],
                    ['Amount', formatINR(Number(form.amount_rupees) * 100)],
                    ['Issued', form.issue_date && formatDate(form.issue_date)],
                    ['Matures', form.maturity_date && formatDate(form.maturity_date)],
                    ['Holders', form.holders],
                    ['Lien in favour of AICTE', form.lien ? 'Yes' : 'No'],
                  ].map(([k, v]) => (
                    <div key={k} className="border-b border-line pb-2">
                      <dt className="text-[0.8125rem] text-ink-3">{k}</dt>
                      <dd className="font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                {scan?.checks?.length ? (
                  <div className="mt-5 rounded-[var(--radius-panel)] border border-due/40 bg-due-soft p-4 text-[0.875rem] text-ink">
                    <p className="font-medium">
                      The receipt check raised {scan.checks.length} point
                      {scan.checks.length > 1 ? 's' : ''} that AICTE will review.
                    </p>
                    <p className="mt-1 text-ink-2">
                      You can still submit. If a value was entered wrongly, go back and correct it
                      first.
                    </p>
                  </div>
                ) : null}
                {submit.isError ? (
                  <p role="alert" className="mt-4 text-[0.875rem] text-overdue">
                    {(submit.error as ApiError).message}
                  </p>
                ) : null}
                <Nav
                  back={() => setStep(2)}
                  next={() => submit.mutate()}
                  nextLabel={submit.isPending ? 'Submitting' : 'Submit to AICTE'}
                  nextDisabled={submit.isPending}
                />
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </Panel>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[1.125rem] font-semibold text-ink">{title}</h2>
      {hint ? <p className="mt-1 mb-5 text-[0.875rem] text-ink-3">{hint}</p> : null}
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-[0.8125rem] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="text-[0.75rem] text-ink-3">{hint}</span> : null}
    </label>
  )
}

function Nav({
  back,
  next,
  nextDisabled,
  nextLabel = 'Continue',
}: {
  back?: () => void
  next: () => void
  nextDisabled?: boolean
  nextLabel?: string
}) {
  return (
    <div className="mt-8 flex justify-between border-t border-line pt-5">
      {back ? (
        <Button variant="ghost" onClick={back}>
          <ArrowLeft /> Back
        </Button>
      ) : (
        <span />
      )}
      <Button variant="primary" size="lg" onClick={next} disabled={nextDisabled}>
        {nextLabel} <ArrowRight />
      </Button>
    </div>
  )
}

function Uploader({
  kind,
  label,
  onDone,
  done,
  declared,
}: {
  kind: string
  label: string
  onDone: (r: Analysis) => void
  done?: string
  declared?: Record<string, string>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument<Analysis>(file, kind, declared),
    onSuccess: onDone,
  })
  const pick = (f: File | undefined) => f && upload.mutate(f)
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          pick(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-[var(--radius-panel)] border-2 border-dashed px-6 py-8 text-center transition-colors',
          drag ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-ink-3',
        )}
      >
        {upload.isPending ? (
          <Loader2 className="size-6 animate-spin text-ink-3" />
        ) : done ? (
          <FileCheck2 className="size-6 text-a2" />
        ) : (
          <FileUp className="size-6 text-ink-3" />
        )}
        <span className="text-[0.9375rem] font-medium text-ink">{done ? done : label}</span>
        <span className="text-[0.8125rem] text-ink-3">
          {done
            ? 'Uploaded. Choose another file to replace it.'
            : 'Drag a file here or choose one. PDF, PNG or JPEG up to 12 MB.'}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {upload.isError ? (
        <p role="alert" className="mt-2 text-[0.875rem] text-overdue">
          {(upload.error as Error).message}
        </p>
      ) : null}
    </div>
  )
}

const READING_STAGES = [
  'Reading the text on the receipt',
  'Matching each value to your entries',
  'Checking amount in figures against words',
  'Looking for signs of alteration',
]

function ReceiptStep({
  declared,
  scan,
  setScan,
  onBack,
  onNext,
  demo,
}: {
  declared: Record<string, string>
  scan: Analysis | null
  setScan: (a: Analysis | null) => void
  onBack: () => void
  onNext: () => void
  demo: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setStage((s) => Math.min(READING_STAGES.length - 1, s + 1)), 1600)
    return () => clearInterval(t)
  }, [busy])
  const entered: Record<string, string> = {
    number: declared.number!,
    ifsc: declared.ifsc!,
    amount: declared.amount!,
    issue_date: declared.issue_date!,
    maturity_date: declared.maturity_date!,
  }
  const mismatchFields = new Set(
    scan?.checks?.filter((c) => c.code === 'declared_mismatch').map((c) => c.field),
  )
  const highlight = scan?.checks?.find((c) => c.severity === 'high')?.field ?? null
  return (
    <Section
      title="Upload the receipt"
      hint="Pramaan reads the receipt and shows you what it found before you submit, so typing mistakes can be fixed now."
    >
      {demo ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] border border-simulated/30 bg-simulated-soft px-4 py-3 text-[0.8125rem] text-ink">
          <FlaskConical className="size-4 text-simulated" />
          Demo mode: try a synthetic specimen receipt.
          <a
            href="/api/v1/documents/specimens/genuine"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            <Download className="size-3.5" /> Genuine specimen
          </a>
          <a
            href="/api/v1/documents/specimens/altered"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            <Download className="size-3.5" /> Altered specimen
          </a>
        </div>
      ) : null}
      {!scan || busy ? (
        <div onClickCapture={() => setStage(0)}>
          <WrappedUploader
            declared={declared}
            onStart={() => {
              setBusy(true)
              setStage(0)
            }}
            onDone={(a) => {
              setBusy(false)
              setScan(a)
            }}
            onFail={() => setBusy(false)}
          />
          {busy ? (
            <ol className="mt-5 grid gap-2">
              {READING_STAGES.map((s, i) => (
                <li
                  key={s}
                  className={cn(
                    'flex items-center gap-3 text-[0.9375rem]',
                    i <= stage ? 'text-ink' : 'text-ink-3',
                  )}
                >
                  {i < stage ? (
                    <Check className="size-4 text-a2" />
                  ) : i === stage ? (
                    <Loader2 className="size-4 animate-spin text-accent" />
                  ) : (
                    <span className="size-4" />
                  )}
                  {s}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <DocumentViewer
              pageUrl={scan.page_url!}
              heatmapUrl={scan.forensics?.regions.length ? scan.heatmap_url : undefined}
              width={scan.width!}
              height={scan.height!}
              fields={scan.fields!}
              regions={scan.forensics?.regions ?? []}
              highlight={highlight}
            />
            <div>
              <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
                <ScanSearch className="size-4 text-ink-3" /> We read these values from your receipt
              </p>
              <ul className="mt-3 grid gap-2">
                {['number', 'ifsc', 'amount', 'issue_date', 'maturity_date'].map((name) => {
                  const f = scan.fields!.find((x) => x.field === name)
                  const bad = mismatchFields.has(name)
                  return (
                    <li
                      key={name}
                      className={cn(
                        'rounded-lg border px-3 py-2',
                        bad ? 'border-overdue/40 bg-overdue-soft/50' : 'border-line',
                      )}
                    >
                      <p className="text-[0.75rem] text-ink-3">{f?.label ?? name}</p>
                      <p className="flex items-center justify-between gap-2 font-mono text-[0.9375rem] text-ink">
                        {f?.display ?? <span className="font-sans text-ink-3">Not read</span>}
                        {f ? (
                          bad ? (
                            <AlertOctagon className="size-4 text-overdue" />
                          ) : (
                            <Check className="size-4 text-a2" />
                          )
                        ) : null}
                      </p>
                      {bad ? (
                        <p className="text-[0.75rem] text-overdue">You entered {entered[name]}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-[0.75rem] text-ink-3">
                Read in {((scan.duration_ms ?? 0) / 1000).toFixed(1)} s ·{' '}
                {scan.model_versions?.forensics}
              </p>
            </div>
          </div>
          {scan.checks?.length ? (
            <ul className="grid gap-2">
              {scan.checks.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-[var(--radius-panel)] border p-3.5',
                    c.severity === 'high'
                      ? 'border-overdue/40 bg-overdue-soft/50'
                      : 'border-due/40 bg-due-soft/60',
                  )}
                >
                  <AlertOctagon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      c.severity === 'high' ? 'text-overdue' : 'text-due',
                    )}
                  />
                  <div>
                    <p className="text-[0.9375rem] font-medium text-ink">{c.title}</p>
                    <p className="text-[0.8125rem] text-ink-2">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-[var(--radius-panel)] border border-a2/30 bg-a2-soft/50 p-3.5 text-[0.9375rem] text-ink">
              <CheckCircle2 className="size-4 text-a2" /> Every value on the receipt matches your
              entries.
            </p>
          )}
          <Button variant="ghost" className="w-fit" onClick={() => setScan(null)}>
            Upload a different file
          </Button>
        </div>
      )}
      <Nav back={onBack} next={onNext} nextDisabled={!scan || busy} />
    </Section>
  )
}

function WrappedUploader({
  declared,
  onStart,
  onDone,
  onFail,
}: {
  declared: Record<string, string>
  onStart: () => void
  onDone: (a: Analysis) => void
  onFail: () => void
}) {
  const [key, setKey] = useState(0)
  return (
    <div
      onChangeCapture={(e) => {
        if ((e.target as HTMLInputElement).files?.length) onStart()
      }}
      onDropCapture={() => onStart()}
    >
      <Uploader
        key={key}
        kind="fdr_scan"
        label="Receipt scan (PDF, PNG or JPEG)"
        declared={declared}
        onDone={(a) => {
          if (a.analysed) onDone(a)
          else {
            onFail()
            setKey((k) => k + 1)
          }
        }}
      />
    </div>
  )
}

function Submitted({ id, signals }: { id: number; signals: number }) {
  return (
    <Panel className="mx-auto max-w-2xl p-10 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="mx-auto grid size-16 place-items-center rounded-full bg-a2-soft"
      >
        <CheckCircle2 className="size-8 text-a2" />
      </motion.div>
      <p lang="hi" className="mt-5 font-deva text-ink-3">
        प्रस्तुत किया गया
      </p>
      <h1 className="text-[1.5rem] font-semibold text-ink">Submitted to AICTE</h1>
      <p className="mt-2 text-[0.9375rem] text-ink-2">
        Reference{' '}
        <span className="font-mono font-medium text-ink">PRM-{String(id).padStart(6, '0')}</span>
      </p>
      <ol className="mx-auto mt-6 grid max-w-md gap-2 text-left text-[0.9375rem] text-ink-2">
        <li>
          <Label>Next</Label> The Regulation Bureau scrutinises the deposit
          {signals
            ? `, including ${signals} point${signals > 1 ? 's' : ''} raised by the receipt check`
            : ''}
          .
        </li>
        <li>AICTE asks {`the issuing bank`} to confirm the deposit directly.</li>
        <li>You will be notified here and by email at each step.</li>
      </ol>
      <Button asChild variant="primary" className="mt-8">
        <Link to="/portal">Back to home</Link>
      </Button>
    </Panel>
  )
}
