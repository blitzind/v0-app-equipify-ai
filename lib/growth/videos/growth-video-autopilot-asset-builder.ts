/** Growth Engine F2 — Script/thumbnail/overlay draft builders (client-safe). */

import { previewGrowthVideoThumbnail } from "@/lib/growth/videos/growth-video-thumbnail-preview-service"
import type {
  GrowthVideoAutopilotDraftPackage,
  GrowthVideoAutopilotOverlayDraft,
  GrowthVideoAutopilotScriptDraft,
  GrowthVideoAutopilotThumbnailDraft,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type { GrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-types"

function firstName(contactName: string | null | undefined): string {
  return contactName?.split(/\s+/)[0]?.trim() || "there"
}

export function buildGrowthVideoAutopilotScriptDraft(
  recommendation: GrowthVideoAutopilotRecommendation,
): GrowthVideoAutopilotScriptDraft {
  const script = recommendation.recommended.script
  const lines = script?.split("\n").filter(Boolean) ?? []
  return {
    script: script ?? null,
    hook: lines[0] ?? null,
    talkingPoints: lines.slice(1, 4),
    ctaCopy: recommendation.recommended.ctaLabel,
    sourcesUsed: ["f1_recommendation.script", "b4_script_metadata"],
  }
}

export function buildGrowthVideoAutopilotThumbnailDraft(
  recommendation: GrowthVideoAutopilotRecommendation,
): GrowthVideoAutopilotThumbnailDraft {
  const preview = previewGrowthVideoThumbnail({
    type: "prospect",
    form: {
      firstName: firstName(recommendation.inputSnapshot.contactName),
      company: recommendation.inputSnapshot.companyName ?? "Prospect",
      industry: recommendation.inputSnapshot.industry ?? undefined,
      ctaLabel: recommendation.recommended.ctaLabel ?? "Watch Now",
    },
    pageTitle: recommendation.recommended.thumbnailText ?? "Personalized Video",
  })

  return {
    thumbnailText: recommendation.recommended.thumbnailText,
    previewDataUrl: preview.previewDataUrl,
    storagePath: null,
    sourcesUsed: ["b3_thumbnail_preview", "f1_recommendation.thumbnailText"],
  }
}

export function buildGrowthVideoAutopilotOverlayDraft(
  recommendation: GrowthVideoAutopilotRecommendation,
): GrowthVideoAutopilotOverlayDraft {
  const overlayText = recommendation.recommended.overlayText
  return {
    overlayText,
    previewHtml: overlayText
      ? `<div class="growth-video-autopilot-overlay">${overlayText}</div>`
      : null,
    sourcesUsed: ["b2_overlay_preview", "f1_recommendation.overlayText"],
  }
}

export function applyGrowthVideoAutopilotAssetDrafts(
  draft: GrowthVideoAutopilotDraftPackage,
  recommendation: GrowthVideoAutopilotRecommendation,
): GrowthVideoAutopilotDraftPackage {
  return {
    ...draft,
    scriptDraft: buildGrowthVideoAutopilotScriptDraft(recommendation),
    thumbnailDraft: buildGrowthVideoAutopilotThumbnailDraft(recommendation),
    overlayDraft: buildGrowthVideoAutopilotOverlayDraft(recommendation),
    sourcesUsed: [
      ...new Set([
        ...draft.sourcesUsed,
        ...buildGrowthVideoAutopilotScriptDraft(recommendation).sourcesUsed,
        ...buildGrowthVideoAutopilotThumbnailDraft(recommendation).sourcesUsed,
        ...buildGrowthVideoAutopilotOverlayDraft(recommendation).sourcesUsed,
      ]),
    ],
  }
}
