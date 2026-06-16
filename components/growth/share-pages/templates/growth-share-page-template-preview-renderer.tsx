"use client"

import { GrowthSharePageView } from "@/components/growth/share-pages/growth-share-page-view"
import { mapTemplateEditorToRenderModel } from "@/lib/growth/share-pages/share-page-template-render-model"
import type { GrowthSharePageTemplateEditorDraft } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import { cn } from "@/lib/utils"

export type GrowthSharePageTemplatePreviewViewport = "desktop" | "tablet" | "mobile"

const VIEWPORT_WIDTH: Record<GrowthSharePageTemplatePreviewViewport, string> = {
  desktop: "max-w-5xl",
  tablet: "max-w-3xl",
  mobile: "max-w-sm",
}

export function GrowthSharePageTemplatePreviewRenderer({
  draft,
  viewport,
  prospectName,
  companyName,
  bookingSlug,
}: {
  draft: GrowthSharePageTemplateEditorDraft
  viewport: GrowthSharePageTemplatePreviewViewport
  prospectName: string
  companyName: string
  bookingSlug?: string | null
}) {
  const preview = mapTemplateEditorToRenderModel({
    blocks: draft.blocks,
    theme: draft.theme,
    prospectName,
    companyName,
    defaultBookingPageId: draft.defaultBookingPageId,
    bookingSlug: bookingSlug ?? null,
  })

  return (
    <div className="space-y-4">
      <div className={cn("mx-auto w-full transition-all", VIEWPORT_WIDTH[viewport])}>
        <GrowthSharePageView model={preview.renderModel} />
      </div>

      {preview.extraBlocks.length > 0 ? (
        <div className={cn("mx-auto w-full space-y-3", VIEWPORT_WIDTH[viewport])}>
          {preview.extraBlocks.map((block) => (
            <div
              key={block.id}
              className="rounded-xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
                {block.type.replace(/_/g, " ")}
              </p>
              <p className="mt-1 font-medium text-amber-950 dark:text-amber-100">{block.label}</p>
              {block.detail ? <p className="mt-2 text-amber-900/80 dark:text-amber-100/80">{block.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
