import { Flame, Maximize2, ScanText, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
 * and the forensic heatmap. Keyboard: + and - zoom, 0 fits, L toggles boxes, H toggles heat.
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
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.25))
      else if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25))
      else if (e.key === '0') setZoom(1)
      else if (e.key.toLowerCase() === 'l') setBoxes((b) => !b)
      else if (e.key.toLowerCase() === 'h') setHeat((h) => !h)
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
        aria-label="Document page. Use plus and minus to zoom, L for field boxes, H for heatmap."
      >
        <div
          className="relative origin-top-left"
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
