"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Wand2, ZoomIn, ZoomOut, Crop, Eraser, Scissors } from "lucide-react"

type EffectKind =
  | "none"
  | "blur"
  | "pixelate"
  | "grayscale"
  | "sepia"
  | "brightness"
  | "contrast"
  | "saturation"
  | "sharpen"
  | "glow"

export type EditorResult = {
  blob: Blob
  name: string
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  file: { url: string; name: string }
  onApply: (result: EditorResult) => void
}

type Rect = { x: number; y: number; w: number; h: number }

export default function ImageEditorDialog({ open, onOpenChange, file, onApply }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [img, setImg] = React.useState<HTMLImageElement | null>(null)
  const [scale, setScale] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [drag, setDrag] = React.useState<{ sx: number; sy: number } | null>(null)
  const [selecting, setSelecting] = React.useState(false)
  const [rect, setRect] = React.useState<Rect | null>(null)

  // Controls
  const [effect, setEffect] = React.useState<EffectKind>("blur")
  const [intensity, setIntensity] = React.useState(10) // blur px, pixel size, etc.
  const [upscale2x, setUpscale2x] = React.useState(false)
  const [overlayText, setOverlayText] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => setImg(i)
    i.src = file.url
  }, [open, file.url])

  React.useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, scale, offset, rect, effect, intensity, overlayText])

  function resetView() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setRect(null)
  }

  function imageToCanvas(i: HTMLImageElement, w?: number, h?: number) {
    const c = document.createElement("canvas")
    c.width = w || i.naturalWidth
    c.height = h || i.naturalHeight
    const ctx = c.getContext("2d")!
    ctx.drawImage(i, 0, 0, c.width, c.height)
    return c
  }

  function applyConvolution(src: ImageData, kernel: number[], divisor?: number, bias = 0) {
    const w = src.width,
      h = src.height
    const out = new ImageData(w, h)
    const d = src.data,
      o = out.data
    const k = kernel
    const div = divisor || k.reduce((a, b) => a + b, 0) || 1

    const idx = (x: number, y: number) => (y * w + x) * 4

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let r = 0,
          g = 0,
          b = 0
        let n = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const i = idx(x + kx, y + ky)
            const kv = k[++n - 1]
            r += d[i] * kv
            g += d[i + 1] * kv
            b += d[i + 2] * kv
          }
        }
        const oi = idx(x, y)
        o[oi] = Math.min(255, Math.max(0, r / div + bias))
        o[oi + 1] = Math.min(255, Math.max(0, g / div + bias))
        o[oi + 2] = Math.min(255, Math.max(0, b / div + bias))
        o[oi + 3] = d[oi + 3]
      }
    }
    return out
  }

  function pixelateRegion(ctx: CanvasRenderingContext2D, r: Rect, size: number) {
    const tmp = ctx.getImageData(r.x, r.y, r.w, r.h)
    const c = document.createElement("canvas")
    c.width = Math.max(1, Math.floor(r.w / size))
    c.height = Math.max(1, Math.floor(r.h / size))
    const cx = c.getContext("2d")!
    // scale down
    cx.imageSmoothingEnabled = false
    // put into small canvas
    const small = document.createElement("canvas")
    small.width = r.w
    small.height = r.h
    const sx = small.getContext("2d")!
    sx.putImageData(tmp, 0, 0)
    cx.drawImage(small, 0, 0, c.width, c.height)
    // scale back up
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(c, r.x, r.y, r.w, r.h)
    ctx.imageSmoothingEnabled = true
  }

  function cssFilterFor(effect: EffectKind, amount: number) {
    switch (effect) {
      case "blur":
        return `blur(${Math.round(amount)}px)`
      case "grayscale":
        return `grayscale(${Math.min(100, amount) / 100})`
      case "sepia":
        return `sepia(${Math.min(100, amount) / 100})`
      case "brightness":
        return `brightness(${1 + amount / 100})`
      case "contrast":
        return `contrast(${1 + amount / 100})`
      case "saturation":
        return `saturate(${1 + amount / 100})`
      case "glow":
        return `blur(${Math.round(amount)}px) brightness(${1 + amount / 200})`
      default:
        return "none"
    }
  }

  function draw() {
    const c = canvasRef.current
    if (!c || !img) return
    const ctx = c.getContext("2d")!
    const W = c.width,
      H = c.height
    ctx.clearRect(0, 0, W, H)

    // Fit image into canvas (contain), plus panning/zooming
    const iw = img.naturalWidth,
      ih = img.naturalHeight
    const scaleBase = Math.min(W / iw, H / ih)
    const s = scaleBase * scale
    const drawW = iw * s,
      drawH = ih * s
    const dx = (W - drawW) / 2 + offset.x
    const dy = (H - drawH) / 2 + offset.y

    ctx.drawImage(img, dx, dy, drawW, drawH)

    // Selection overlay
    if (rect) {
      ctx.save()
      ctx.strokeStyle = "#22c55e"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
      ctx.restore()
    }
  }

  function canvasToBlob(c: HTMLCanvasElement, type = "image/png", quality = 0.95) {
    return new Promise<Blob>((res) => c.toBlob((b) => res(b as Blob), type, quality))
  }

  async function applyAndExport() {
    if (!img) return
    // Work in original resolution
    const base = imageToCanvas(img)
    const ctx = base.getContext("2d")!

    const region: Rect = rect || { x: 0, y: 0, w: base.width, h: base.height }

    if (effect === "pixelate") {
      pixelateRegion(ctx, region, Math.max(4, Math.floor(intensity / 2)))
    } else if (effect === "sharpen") {
      const data = ctx.getImageData(region.x, region.y, region.w, region.h)
      // Simple sharpen kernel, strength by intensity
      const k = 1 + intensity / 50
      const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0]
      const out = applyConvolution(data, kernel, 1)
      ctx.putImageData(out, region.x, region.y)
    } else if (effect !== "none") {
      // Use CSS filters by drawing region into temp canvas
      const tmp = document.createElement("canvas")
      tmp.width = region.w
      tmp.height = region.h
      const tctx = tmp.getContext("2d")!
      tctx.filter = cssFilterFor(effect, intensity)
      tctx.drawImage(base, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h)
      ctx.clearRect(region.x, region.y, region.w, region.h)
      ctx.drawImage(tmp, region.x, region.y)
    }

    if (overlayText.trim()) {
      ctx.save()
      ctx.font = `${Math.max(24, Math.floor(base.width / 24))}px ui-sans-serif, system-ui`
      ctx.fillStyle = "rgba(255,255,255,0.95)"
      ctx.strokeStyle = "rgba(0,0,0,0.65)"
      ctx.lineWidth = Math.max(3, Math.floor(base.width / 320))
      const x = Math.floor(base.width * 0.04)
      const y = Math.floor(base.height * 0.1)
      ctx.strokeText(overlayText, x, y)
      ctx.fillText(overlayText, x, y)
      ctx.restore()
    }

    let out = base

    if (upscale2x) {
      const up = document.createElement("canvas")
      up.width = base.width * 2
      up.height = base.height * 2
      const ux = up.getContext("2d")!
      ux.imageSmoothingEnabled = true
      ux.imageSmoothingQuality = "high"
      ux.drawImage(base, 0, 0, up.width, up.height)
      // mild sharpen after upscale
      const data = ux.getImageData(0, 0, up.width, up.height)
      const k = 1.2
      const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0]
      const outData = applyConvolution(data, kernel, 1)
      ux.putImageData(outData, 0, 0)
      out = up
    }

    const blob = await canvasToBlob(out, "image/png", 0.95)
    onApply({ blob, name: `edited-${file.name.replace(/\.[^.]+$/, "")}.png` })
    onOpenChange(false)
  }

  function toCanvasCoords(clientX: number, clientY: number) {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
          <div className="relative border rounded-md overflow-hidden bg-black/5">
            <canvas
              ref={canvasRef}
              width={1024}
              height={576}
              className="w-full h-[360px] md:h-[420px] bg-black/5"
              onMouseDown={(e) => {
                if (!selecting) return setDrag({ sx: e.clientX, sy: e.clientY })
                const { x, y } = toCanvasCoords(e.clientX, e.clientY)
                setRect({ x, y, w: 0, h: 0 })
                setDrag({ sx: e.clientX, sy: e.clientY })
              }}
              onMouseMove={(e) => {
                if (!drag) return
                if (!selecting) {
                  setOffset((o) => ({ x: o.x + (e.clientX - drag.sx), y: o.y + (e.clientY - drag.sy) }))
                  setDrag({ sx: e.clientX, sy: e.clientY })
                } else {
                  const { x, y } = toCanvasCoords(e.clientX, e.clientY)
                  setRect((r) => (r ? { ...r, w: x - r.x, h: y - r.y } : null))
                }
              }}
              onMouseUp={() => setDrag(null)}
            />
          </div>

          <div className="space-y-4">
            <Tabs defaultValue="effects">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="effects">Effects</TabsTrigger>
                <TabsTrigger value="view">View</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
              </TabsList>

              <TabsContent value="effects" className="space-y-3 pt-2">
                <div>
                  <Label>Operation</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        "blur",
                        "pixelate",
                        "grayscale",
                        "sepia",
                        "brightness",
                        "contrast",
                        "saturation",
                        "sharpen",
                        "glow",
                      ] as EffectKind[]
                    ).map((k) => (
                      <Button
                        key={k}
                        type="button"
                        variant={effect === k ? "default" : "secondary"}
                        onClick={() => setEffect(k)}
                      >
                        {k}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Intensity</Label>
                  <Slider value={[intensity]} onValueChange={([v]) => setIntensity(v)} min={1} max={100} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input type="checkbox" checked={upscale2x} onChange={(e) => setUpscale2x(e.target.checked)} />
                    <Label>Upscale 2× (HD)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={selecting ? "default" : "secondary"}
                      onClick={() => setSelecting((v) => !v)}
                      title="Toggle region select"
                    >
                      <Scissors className="h-4 w-4 mr-2" /> Region
                    </Button>
                    <Button variant="secondary" onClick={() => setRect(null)} title="Clear region">
                      <Eraser className="h-4 w-4 mr-2" /> Clear
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="view" className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" onClick={() => setScale((s) => s * 1.1)}>
                    <ZoomIn className="h-4 w-4 mr-2" /> Zoom in
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => setScale((s) => s / 1.1)}>
                    <ZoomOut className="h-4 w-4 mr-2" /> Zoom out
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => resetView()}>
                    <Crop className="h-4 w-4 mr-2" /> Reset
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-3 pt-2">
                <Label htmlFor="overlay">Add Text Overlay</Label>
                <Input
                  id="overlay"
                  placeholder="Caption..."
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Text appears at the top-left. Use it for watermarks, notes, or effects labels.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={applyAndExport}>
            <Wand2 className="h-4 w-4 mr-2" /> Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
