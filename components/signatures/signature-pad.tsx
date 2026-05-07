"use client"

/**
 * Shared signature pad canvas — used by:
 *   - Work order customer signature capture
 *   - Technician stored signature draw flow
 *
 * Exposes a small imperative API (`clear`, `toBlob`, `hasStrokes`) via a ref
 * so wrapping dialogs can drive the actions without re-implementing the
 * mouse/touch drawing logic. The component itself is purely presentational
 * and never persists anything — callers handle storage / upload.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export type SignaturePadHandle = {
  /** Clear the current strokes — equivalent to pressing the Clear button. */
  clear(): void
  /**
   * Encode the current canvas to a PNG `Blob`. Resolves to `null` when there
   * are no strokes (callers can use `hasStrokes` to gate the Save button
   * without awaiting).
   */
  toBlob(): Promise<Blob | null>
  /** True when at least one stroke has been drawn since the last clear. */
  hasStrokes(): boolean
}

export type SignaturePadProps = {
  /** Notified whenever the strokes state flips (used to enable the Save button). */
  onStrokesChange?: (hasStrokes: boolean) => void
  /** Internal canvas dimensions (px) — used for the rendered PNG. */
  width?: number
  height?: number
  /** Render the canvas read-only (no strokes accepted). */
  disabled?: boolean
  className?: string
  /** Stroke color. Defaults to the same dark navy we use for WO signatures. */
  strokeColor?: string
  /** Stroke width (CSS pixels). */
  strokeWidth?: number
  /** ARIA label for the canvas. */
  ariaLabel?: string
}

function getCanvasPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if ("touches" in e) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY,
    }
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      onStrokesChange,
      width = 600,
      height = 220,
      disabled = false,
      className,
      strokeColor = "#1a1a2e",
      strokeWidth = 2.5,
      ariaLabel = "Signature pad",
    },
    ref,
  ) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const drawingRef = React.useRef(false)
    const strokesRef = React.useRef(false)

    const setStrokes = React.useCallback(
      (next: boolean) => {
        if (strokesRef.current === next) return
        strokesRef.current = next
        onStrokesChange?.(next)
      },
      [onStrokesChange],
    )

    const clear = React.useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawingRef.current = false
      setStrokes(false)
    }, [setStrokes])

    React.useImperativeHandle<SignaturePadHandle, SignaturePadHandle>(
      ref,
      () => ({
        clear,
        hasStrokes: () => strokesRef.current,
        toBlob: () =>
          new Promise<Blob | null>((resolve) => {
            const canvas = canvasRef.current
            if (!canvas || !strokesRef.current) {
              resolve(null)
              return
            }
            canvas.toBlob((b) => resolve(b), "image/png")
          }),
      }),
      [clear],
    )

    function startDraw(e: React.MouseEvent | React.TouchEvent) {
      if (disabled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const native = e.nativeEvent as MouseEvent | TouchEvent
      const pos = getCanvasPos(native, canvas)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      drawingRef.current = true
    }

    function draw(e: React.MouseEvent | React.TouchEvent) {
      if (!drawingRef.current || disabled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const native = e.nativeEvent as MouseEvent | TouchEvent
      const pos = getCanvasPos(native, canvas)
      ctx.lineWidth = strokeWidth
      ctx.lineCap = "round"
      ctx.strokeStyle = strokeColor
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      setStrokes(true)
    }

    function endDraw() {
      drawingRef.current = false
    }

    return (
      <div
        className={cn(
          "border-2 border-dashed border-border rounded-lg overflow-hidden touch-none select-none dark:bg-[#0B111E] dark:border-[#25324C]",
          disabled && "opacity-60 pointer-events-none",
          className,
        )}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          aria-label={ariaLabel}
          role="img"
          className="w-full min-h-[140px] cursor-crosshair max-h-56 touch-none sm:max-h-44"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
    )
  },
)
