import * as Dialog from '@radix-ui/react-dialog'
import { useNavigate } from '@tanstack/react-router'
import { Camera, ScanLine, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Seal } from '@/components/security/seal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/primitives'

/** The token from a verification link, or the text itself when it is a bare code. */
export function tokenFrom(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/\/verify\/([^/?#\s]+)/)
  if (m) return decodeURIComponent(m[1]!)
  return /^[\w.~-]{8,}$/.test(t) ? t : null
}

/**
 * Anyone can check a Pramaan letter: paste its link or code, or hold its QR code up to the
 * camera. Decoding happens in the browser; only the token is sent, to the public verify endpoint.
 */
export function VerifyPanel() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const go = (raw: string) => {
    const token = tokenFrom(raw)
    if (!token) {
      setError('That does not look like a Pramaan verification link or code.')
      return
    }
    void navigate({ to: '/verify/$token', params: { token } })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    go(text)
  }

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-accent uppercase">
          Public verification <span lang="hi" className="font-deva normal-case">सार्वजनिक सत्यापन</span>
        </p>
        <h2 className="mt-2 font-display text-[2.75rem] leading-[1.02] text-ink">
          Is this letter genuine? Check it in one scan.
        </h2>
        <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-ink-2">
          Every NOC, sanction order and acknowledgement Pramaan issues carries a signed QR code. Banks,
          institutions and members of the public can check it here, without signing in. The answer
          comes from AICTE&apos;s record, not from the paper.
        </p>
        <form onSubmit={submit} className="mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="verify-code">
            Verification link or code
          </label>
          <Input
            id="verify-code"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder="Paste the link or code printed under the QR"
            className="h-11 text-[0.9375rem]"
            aria-describedby={error ? 'verify-error' : undefined}
          />
          <Button type="submit" variant="primary" className="h-11 px-5">
            <ShieldCheck /> Verify
          </Button>
          <Button type="button" className="h-11 px-5" onClick={() => setScanning(true)}>
            <Camera /> Scan QR
          </Button>
        </form>
        {error ? (
          <p id="verify-error" role="alert" className="mt-2 text-[0.8125rem] text-overdue">
            {error}
          </p>
        ) : null}
      </div>
      <PhoneSpecimen />
      <ScanDialog open={scanning} onOpenChange={setScanning} onCode={go} />
    </div>
  )
}

function PhoneSpecimen() {
  return (
    <div className="relative mx-auto w-[280px]" aria-hidden>
      <div className="rounded-[42px] border-[10px] border-board bg-board p-1 shadow-[0_50px_90px_-40px_rgb(18_23_38/0.65)]">
        <div className="overflow-hidden rounded-[32px] bg-canvas">
          <div className="tricolour h-1" />
          <div className="px-5 pt-6 pb-7 text-center">
            <p lang="hi" className="font-deva text-[0.8125rem] text-ink-3">
              दस्तावेज़ सत्यापन
            </p>
            <p className="text-[0.75rem] text-ink-3">Document verification</p>
            <div className="mx-auto mt-4 grid place-items-center">
              <Seal size={120} tone="green" seed="verify-specimen" legend="Genuine  •  प्रामाणिक  •  " />
            </div>
            <p className="mt-3 font-display text-[2rem] leading-none text-a2">Genuine</p>
            <p lang="hi" className="font-deva text-[0.875rem] text-a2">
              प्रामाणिक
            </p>
            <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-left text-[0.6875rem]">
              <Row k="Letter" v="Release NOC" />
              <Row k="Reference" v="AICTE/RB/NOC/2026/0412" mono />
              <Row k="Issued" v="26 Oct 2026" />
            </div>
            <p className="mt-3 text-[0.625rem] text-ink-3">Specimen</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <p className="flex justify-between gap-3 py-0.5">
      <span className="text-ink-3">{k}</span>
      <span className={mono ? 'font-mono text-ink' : 'text-ink'}>{v}</span>
    </p>
  )
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

function ScanDialog({
  open,
  onOpenChange,
  onCode,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCode: (text: string) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let last = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    setProblem(null)

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem('This browser cannot use the camera. Paste the link instead.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
      } catch {
        setProblem('Camera permission was not given. Paste the link instead, or allow the camera and try again.')
        return
      }
      if (stopped || !video.current) return
      video.current.srcObject = stream
      await video.current.play().catch(() => undefined)
      // The browser's own detector where it exists (Chrome on most platforms), jsQR elsewhere.
      const native = (window as unknown as { BarcodeDetector?: new (o: object) => Detector })
        .BarcodeDetector
      const detector = native ? new native({ formats: ['qr_code'] }) : null
      const jsqr = detector ? null : (await import('jsqr')).default

      const tick = async (now: number) => {
        if (stopped) return
        raf = requestAnimationFrame(tick)
        const v = video.current
        if (!v || v.readyState < 2 || now - last < 160 || !ctx) return
        last = now
        let found: string | null = null
        if (detector) {
          const codes = await detector.detect(v).catch(() => [])
          found = codes[0]?.rawValue ?? null
        } else if (jsqr) {
          canvas.width = v.videoWidth
          canvas.height = v.videoHeight
          ctx.drawImage(v, 0, 0)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          found = jsqr(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
        }
        if (found && !stopped) {
          stopped = true
          onOpenChange(false)
          onCode(found)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, onCode, onOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-board/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-overlay)]">
          <div className="flex items-center justify-between px-5 py-4">
            <Dialog.Title className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
              <ScanLine className="size-4 text-accent" /> Hold the QR code up to the camera
            </Dialog.Title>
            <Dialog.Close className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            The camera image is decoded on this device. Only the code is sent to Pramaan.
          </Dialog.Description>
          <div className="relative aspect-[4/3] bg-board">
            <video ref={video} muted playsInline className="size-full object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
              <div className="relative size-[58%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]">
                <span className="scan-line absolute inset-x-3 top-0 h-0.5 bg-saffron shadow-[0_0_12px_var(--saffron)] [animation-iteration-count:infinite]" />
              </div>
            </div>
            {problem ? (
              <p role="alert" className="absolute inset-x-4 bottom-4 rounded-lg bg-surface px-3 py-2 text-[0.8125rem] text-ink">
                {problem}
              </p>
            ) : null}
          </div>
          <p className="px-5 py-3 text-[0.75rem] text-ink-3">
            The image stays on this device. Only the decoded code is checked against AICTE&apos;s record.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
