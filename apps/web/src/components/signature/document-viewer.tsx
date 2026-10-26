import { Flame, Lamp, Maximize2, ScanText, ZoomIn, ZoomOut } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export type ViewerField = {
  field: string
  label: string
  display: string
  box: number[]
  confidence: number
}
export type ViewerRegion = { box: number[]; score: number }

/**
 * Pan-and-zoom view of an analysed page with two layers: OCR boxes over the fields that were read,
 * and the forensic heatmap. Keyboard: + and - zoom, 0 fits, L toggles boxes, H toggles heat, U
 * toggles the UV lamp: a magnifying loupe that shows the page as a bank's note checker would, with
 * the model's heatmap glowing where it marked a possible alteration. The page is swept once by a
 * scan line when it first loads.
 */
export function DocumentViewer({
  pageUrl,
  heatmapUrl,
  width,
  height,
  fields,
  regions,
  highlight,
  className,
}: {
  pageUrl: string
  heatmapUrl?: string
  width: number
  height: number
  fields: ViewerField[]
  regions: ViewerRegion[]
  highlight?: string | null
  className?: string
}) {
  const [zoom, setZoom] = useState(1)
  const [boxes, setBoxes] = useState(true)
  const [heat, setHeat] = useState(true)
  const [opacity, setOpacity] = useState(0.75)
  const [loaded, setLoaded] = useState(false)
  const [uv, setUv] = useState(false)
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const reduce = useReducedMotion()
  const frame = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const LENS = 200
  const MAG = 2.2

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!uv || !sheet.current) return
    const r = sheet.current.getBoundingClientRect()
    setLens({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height })
  }

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.25))
      else if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25))
      else if (e.key === '0') setZoom(1)
      else if (e.key.toLowerCase() === 'l') setBoxes((b) => !b)
      else if (e.key.toLowerCase() === 'h') setHeat((h) => !h)
      else if (e.key.toLowerCase() === 'u') setUv((u) => !u)
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [])

  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-sunken',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
        <Button
          size="sm"
          variant={boxes ? 'secondary' : 'ghost'}
          onClick={() => setBoxes((b) => !b)}
          aria-pressed={boxes}
        >
          <ScanText /> Fields read
        </Button>
        {heatmapUrl ? (
          <Button
            size="sm"
            variant={heat ? 'secondary' : 'ghost'}
            onClick={() => setHeat((h) => !h)}
            aria-pressed={heat}
          >
            <Flame /> Heatmap
          </Button>
        ) : null}
        {heatmapUrl && heat ? (
          <label className="ml-1 flex items-center gap-2 text-[0.75rem] text-ink-3">
            Opacity
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-24 accent-[var(--accent)]"
            />
          </label>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setUv((u) => !u)}
          aria-pressed={uv}
          className={cn(
            'border',
            uv
              ? 'border-simulated bg-simulated text-white hover:bg-simulated hover:text-white'
              : 'border-simulated/40 text-simulated hover:bg-simulated-soft hover:text-simulated',
          )}
        >
          <Lamp /> UV lamp
        </Button>
        <span className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            aria-label="Zoom out"
          >
            <ZoomOut />
          </Button>
          <span className="w-12 text-center font-mono text-[0.75rem] text-ink-3">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            aria-label="Zoom in"
          >
            <ZoomIn />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setZoom(1)}
            aria-label="Fit to width"
          >
            <Maximize2 />
          </Button>
        </span>
      </div>
      <div
        ref={frame}
        tabIndex={0}
        className="relative max-h-[640px] flex-1 overflow-auto focus-visible:outline-none"
        aria-label="Document page. Use plus and minus to zoom, L for field boxes, H for heatmap, U for the UV lamp."
      >
        <div
          ref={sheet}
          onPointerMove={onMove}
          onPointerLeave={() => setLens(null)}
          className={cn('relative origin-top-left', uv && 'cursor-none')}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${width} / ${height}` }}
        >
          {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
          <img
            src={pageUrl}
            alt="Uploaded receipt"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full select-none"
            draggable={false}
          />
          {heatmapUrl && heat ? (
            <img
              src={heatmapUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
              style={{ opacity }}
            />
          ) : null}
          {boxes
            ? fields.map((f) => {
                const [x0, y0, x1, y1] = f.box as [number, number, number, number]
                const on = highlight === f.field
                return (
                  <div
                    key={f.field}
                    className={cn(
                      'group absolute rounded-[3px] border-2 transition-colors',
                      on ? 'border-overdue bg-overdue/10' : 'border-a1/70 bg-a1/5 hover:bg-a1/10',
                    )}
                    style={{
                      left: pct(x0 - 3, width),
                      top: pct(y0 - 3, height),
                      width: pct(x1 - x0 + 6, width),
                      height: pct(y1 - y0 + 6, height),
                    }}
                  >
                    <span
                      className={cn(
                        'absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium whitespace-nowrap text-white',
                        on ? 'bg-overdue' : 'bg-a1 opacity-0 group-hover:opacity-100',
                      )}
                    >
                      {f.label} · {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                )
              })
            : null}
          {loaded && !reduce ? (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="scan-line absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-a1/25 to-a1/60 [box-shadow:0_6px_14px_-4px_var(--a1)]" />
            </div>
          ) : null}
          {uv && lens ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-[3px] border-simulated shadow-[0_0_0_6px_rgb(107_79_160/0.25),0_0_40px_rgb(140_90_255/0.6),0_18px_40px_-12px_rgb(0_0_0/0.6)]"
              style={{ width: LENS, height: LENS, left: lens.x - LENS / 2, top: lens.y - LENS / 2 }}
            >
              <div
                className="absolute bg-[var(--uv-ground)]"
                style={{
                  width: lens.w * MAG,
                  height: lens.h * MAG,
                  left: LENS / 2 - lens.x * MAG,
                  top: LENS / 2 - lens.y * MAG,
                }}
              >
                <img
                  src={pageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full"
                  style={{
                    filter:
                      'grayscale(1) invert(1) sepia(1) hue-rotate(215deg) saturate(2.6) brightness(0.75) contrast(1.3)',
                  }}
                  draggable={false}
                />
                {heatmapUrl ? (
                  <img
                    src={heatmapUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full mix-blend-screen"
                    style={{
                      filter:
                        'invert(1) hue-rotate(150deg) saturate(4) brightness(1.4) blur(0.5px)',
                    }}
                    draggable={false}
                  />
                ) : null}
                {regions.map((r, i) => {
                  const [x0, y0, x1, y1] = r.box as [number, number, number, number]
                  return (
                    <div
                      key={i}
                      className="absolute rounded-md border-2 border-[var(--uv-glow)] shadow-[0_0_14px_var(--uv-glow)]"
                      style={{
                        left: pct(x0 - 6, width),
                        top: pct(y0 - 6, height),
                        width: pct(x1 - x0 + 12, width),
                        height: pct(y1 - y0 + 12, height),
                      }}
                    />
                  )
                })}
              </div>
              <span className="absolute inset-x-0 bottom-3 text-center font-mono text-[0.5625rem] tracking-[0.2em] text-white/70 uppercase">
                UV {MAG}x
              </span>
            </div>
          ) : null}
          {regions.map((r, i) => {
            const [x0, y0, x1, y1] = r.box as [number, number, number, number]
            return (
              <div
                key={i}
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-overdue"
                style={{
                  left: pct(x0 - 6, width),
                  top: pct(y0 - 6, height),
                  width: pct(x1 - x0 + 12, width),
                  height: pct(y1 - y0 + 12, height),
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
