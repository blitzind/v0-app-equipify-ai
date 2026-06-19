"use client"

import type {
  GrowthVideoOverlayB2Config,
  GrowthVideoOverlayResolvedPreviewItem,
} from "@/lib/growth/videos/growth-video-types"
import {
  growthVideoOverlayB2InlineStyle,
  growthVideoOverlayB2PositionClass,
} from "@/lib/growth/videos/growth-video-overlay-render-service"
import { cn } from "@/lib/utils"

export function GrowthVideoOverlayPreview({
  previewItems,
  playbackPreviewUrl,
  className,
}: {
  previewItems: GrowthVideoOverlayResolvedPreviewItem[]
  playbackPreviewUrl?: string | null
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Rendered overlay preview (HTML/CSS only — no video burn-in)
      </p>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
        {playbackPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={playbackPreviewUrl} alt="" className="size-full object-cover opacity-90" />
        ) : (
          <div className="flex size-full items-center justify-center bg-slate-900 text-xs text-slate-400">
            Video preview area
          </div>
        )}

        {previewItems.map((overlay) => (
          <div
            key={overlay.id}
            className={cn(
              "absolute z-10 text-xs font-medium shadow-sm",
              growthVideoOverlayB2PositionClass(overlay.position),
              overlay.position === "lower_third" ? "w-auto max-w-none text-left" : "text-center",
            )}
            style={growthVideoOverlayB2InlineStyle(overlay.style)}
          >
            <span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {overlay.resolvedText}
            </span>
          </div>
        ))}

        {previewItems.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] text-slate-400">
            No enabled overlays
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type { GrowthVideoOverlayB2Config }
