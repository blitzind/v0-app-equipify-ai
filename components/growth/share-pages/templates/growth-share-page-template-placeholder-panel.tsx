"use client"

import { Film, Mic, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { GrowthMediaVideoOverlayPreview } from "@/components/growth/media/growth-media-video-overlay-preview"
import type { GrowthSharePageTemplatePreviewBlock } from "@/lib/growth/share-pages/share-page-template-render-model"
import {
  buildSharePageTemplatePreviewMergeValues,
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import { cn } from "@/lib/utils"

function useVideoThumbnailPreviewUrl(videoAssetId: string | null | undefined) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!videoAssetId) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    void fetch(`/api/platform/growth/media-assets/video/${videoAssetId}/thumbnail`)
      .then((res) => res.json() as Promise<{ ok?: boolean; thumbnail?: { previewUrl?: string | null } }>)
      .then((data) => {
        if (!cancelled) setPreviewUrl(data.thumbnail?.previewUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [videoAssetId])

  return previewUrl
}

function WaveformPlaceholder() {
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden>
      {[0.35, 0.7, 0.45, 0.9, 0.55, 0.75, 0.4, 0.85, 0.5, 0.65].map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-violet-400/80 dark:bg-violet-300/70"
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  )
}

export function GrowthSharePageTemplatePlaceholderPanel({
  block,
  mergeValues,
}: {
  block: GrowthSharePageTemplatePreviewBlock
  mergeValues?: Record<string, string>
}) {
  const resolvedMergeValues =
    mergeValues ?? buildSharePageTemplatePreviewMergeValues(DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT)
  const thumbnailPreviewUrl = useVideoThumbnailPreviewUrl(
    block.type === "video_placeholder" ? block.videoAssetId : null,
  )

  if (block.type === "video_placeholder") {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-dashed border-sky-300 bg-sky-50/80 dark:border-sky-700 dark:bg-sky-950/40",
          block.layout === "compact" ? "p-3" : "p-4",
        )}
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800 dark:text-sky-200">
              Video placeholder
            </p>
            {block.heading ? (
              <p className="mt-1 text-sm font-medium text-sky-950 dark:text-sky-50">{block.heading}</p>
            ) : null}
            <p className="mt-1 text-sm text-sky-900/80 dark:text-sky-100/80">{block.label}</p>
          </div>

          <GrowthMediaVideoOverlayPreview
            overlaySpec={block.overlaySpec}
            mergeValues={resolvedMergeValues}
            thumbnailPreviewUrl={thumbnailPreviewUrl}
            layout={block.layout ?? "wide"}
          />

          <p className="text-xs text-sky-800/70 dark:text-sky-200/70">
            Overlay + thumbnail preview only — no playback or analytics tracking.
          </p>
        </div>
      </div>
    )
  }

  if (block.type === "voice_placeholder") {
    return (
      <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/80 p-4 dark:border-violet-700 dark:bg-violet-950/40">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet-200/80 text-violet-800 dark:bg-violet-900/70 dark:text-violet-100">
            <Mic className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-800 dark:text-violet-200">
                Voice placeholder
              </p>
              {block.heading ? (
                <p className="mt-1 text-sm font-medium text-violet-950 dark:text-violet-50">{block.heading}</p>
              ) : null}
              <p className="mt-1 text-sm text-violet-900/80 dark:text-violet-100/80">{block.label}</p>
            </div>
            <WaveformPlaceholder />
            {block.showTranscript !== false ? (
              <div className="rounded-lg border border-violet-200/80 bg-white/70 p-3 text-xs text-violet-900/80 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100/80">
                Transcript preview: personalized voice note for the prospect will appear here.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (block.type === "media_cta_placeholder") {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/80 p-4 dark:border-amber-700 dark:bg-amber-950/40">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100">
            <Sparkles className="size-7" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
              Media CTA placeholder
            </p>
            {block.heading ? (
              <p className="text-sm font-medium text-amber-950 dark:text-amber-50">{block.heading}</p>
            ) : null}
            <p className="text-sm text-amber-900/80 dark:text-amber-100/80">{block.label}</p>
            <div className="inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white dark:bg-amber-500">
              {block.ctaLabel || "Watch and book"}
            </div>
            <p className="text-xs text-amber-800/70 dark:text-amber-200/70">
              CTA + thumbnail preview only — no upload or playback.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
        {block.type.replace(/_/g, " ")}
      </p>
      <p className="mt-1 font-medium text-amber-950 dark:text-amber-100">{block.label}</p>
      {block.detail ? <p className="mt-2 text-amber-900/80 dark:text-amber-100/80">{block.detail}</p> : null}
    </div>
  )
}
