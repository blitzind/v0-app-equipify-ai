"use client"

import { GrowthSharePageView } from "@/components/growth/share-pages/growth-share-page-view"
import { GrowthSharePageTemplatePlaceholderPanel } from "@/components/growth/share-pages/templates/growth-share-page-template-placeholder-panel"
import { shouldEmitGrowthMediaPlaybackAnalytics } from "@/hooks/growth/use-growth-media-playback-analytics"
import type { GrowthSharePageTemplatePreviewContext } from "@/lib/growth/share-pages/share-page-template-preview-context"
import {
  buildSharePageTemplatePreviewMergeValues,
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
  GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH,
  type GrowthSharePageTemplatePreviewViewport,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import type { GrowthSharePageTemplateEditorDraft } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import { mapTemplateEditorToRenderModel } from "@/lib/growth/share-pages/share-page-template-render-model"
import { cn } from "@/lib/utils"

export type { GrowthSharePageTemplatePreviewViewport } from "@/lib/growth/share-pages/share-page-template-preview-context"
export { GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH } from "@/lib/growth/share-pages/share-page-template-preview-context"

export function GrowthSharePageTemplatePreviewRenderer({
  draft,
  viewport,
  previewContext,
  prospectName,
  companyName,
  bookingSlug,
}: {
  draft: GrowthSharePageTemplateEditorDraft
  viewport: GrowthSharePageTemplatePreviewViewport
  previewContext?: GrowthSharePageTemplatePreviewContext
  prospectName?: string
  companyName?: string
  bookingSlug?: string | null
}) {
  const preview = mapTemplateEditorToRenderModel({
    blocks: draft.blocks,
    theme: draft.theme,
    previewContext,
    prospectName,
    companyName,
    defaultBookingPageId: draft.defaultBookingPageId,
    bookingSlug: bookingSlug ?? null,
  })

  const analyticsPreviewMode = previewContext?.analyticsPreviewMode ?? true
  const resolvedPreviewContext = previewContext ?? {
    ...DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
    prospectName: prospectName ?? DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.prospectName,
    companyName: companyName ?? DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.companyName,
  }
  const mergeValues = buildSharePageTemplatePreviewMergeValues(resolvedPreviewContext)
  const analyticsEmitBlocked = !shouldEmitGrowthMediaPlaybackAnalytics({
    assetId: preview.extraBlocks.find((block) => block.videoAssetId)?.videoAssetId ?? "",
    analyticsPreviewMode,
    trackingToken: null,
    enabled: true,
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Template preview analytics: {analyticsPreviewMode ? "disabled (analyticsPreviewMode)" : "enabled"} —{" "}
        {analyticsEmitBlocked ? "no playback analytics events emitted" : "hook-ready only"}
      </p>
      <div className={cn("mx-auto w-full transition-all", GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH[viewport])}>
        <GrowthSharePageView model={preview.renderModel} />
      </div>

      {preview.extraBlocks.length > 0 ? (
        <div className={cn("mx-auto w-full space-y-3", GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH[viewport])}>
          {preview.extraBlocks.map((block) => (
            <GrowthSharePageTemplatePlaceholderPanel
              key={block.id}
              block={block}
              mergeValues={mergeValues}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
