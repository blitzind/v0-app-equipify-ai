"use client"

import type { CSSProperties } from "react"
import { Film } from "lucide-react"
import type { GrowthMediaVideoOverlaySpec } from "@/lib/growth/media/media-video-overlay-types"
import {
  GROWTH_MEDIA_VIDEO_OVERLAY_POSITION_CLASSES,
  resolveVideoOverlayItems,
} from "@/lib/growth/media/media-video-overlay-utils"
import { cn } from "@/lib/utils"

function overlayStyle(input: {
  fontSize: number | null
  fontWeight: string | null
  alignment: string | null
  textColor: string | null
  backgroundColor: string | null
  backgroundOpacity: number | null
  borderRadius: number | null
  padding: number | null
  maxWidth: number | null
}): CSSProperties {
  const opacity = input.backgroundOpacity ?? 0.72
  const background = input.backgroundColor ?? "#0f172a"
  return {
    fontSize: input.fontSize ? `${input.fontSize}px` : undefined,
    fontWeight:
      input.fontWeight === "bold"
        ? 700
        : input.fontWeight === "semibold"
          ? 600
          : input.fontWeight === "medium"
            ? 500
            : 400,
    textAlign: (input.alignment ?? "center") as CSSProperties["textAlign"],
    color: input.textColor ?? "#ffffff",
    backgroundColor: background.startsWith("#")
      ? `${background}${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, "0")}`
      : background,
    borderRadius: input.borderRadius != null ? `${input.borderRadius}px` : "8px",
    padding: input.padding != null ? `${input.padding}px` : "8px",
    maxWidth: input.maxWidth != null ? `${input.maxWidth}%` : "80%",
  }
}

export function GrowthMediaVideoOverlayPreview({
  overlaySpec,
  mergeValues,
  thumbnailPreviewUrl,
  layout = "wide",
  previewSeconds = 0,
  className,
}: {
  overlaySpec: GrowthMediaVideoOverlaySpec | null | undefined
  mergeValues: Record<string, string>
  thumbnailPreviewUrl?: string | null
  layout?: "wide" | "compact"
  previewSeconds?: number
  className?: string
}) {
  const overlays = resolveVideoOverlayItems(overlaySpec, mergeValues, previewSeconds)

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Overlay preview (static, no playback)</p>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-sky-200/80 bg-sky-100/60 dark:border-sky-800 dark:bg-sky-950/50",
          layout === "compact" ? "aspect-[4/3] min-h-28" : "aspect-video min-h-36",
        )}
      >
        {thumbnailPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailPreviewUrl} alt="Video thumbnail" className="size-full object-cover opacity-90" />
        ) : (
          <div className="flex size-full items-center justify-center text-sky-800/70 dark:text-sky-200/70">
            <Film className={layout === "compact" ? "size-8" : "size-10"} />
          </div>
        )}

        {overlays.map((overlay) => (
          <div
            key={overlay.id}
            className={cn(
              "absolute z-10 max-w-[90%] text-xs shadow-sm",
              GROWTH_MEDIA_VIDEO_OVERLAY_POSITION_CLASSES[overlay.position],
              overlay.position === "lower_third" ? "w-auto max-w-none" : "",
            )}
            style={{ ...overlayStyle(overlay.style), zIndex: overlay.zIndex }}
          >
            <span className="block whitespace-pre-wrap">{overlay.resolvedText}</span>
            {overlay.usedFallback ? (
              <span className="mt-1 block text-[10px] opacity-70">fallback text</span>
            ) : null}
          </div>
        ))}

        {overlays.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-muted-foreground">
            No enabled overlays at preview time
          </div>
        ) : null}
      </div>
    </div>
  )
}
