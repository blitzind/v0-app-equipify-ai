/** Growth Engine F1 — Video Autopilot preview assembly (server-only). */

import "server-only"

import { buildSequenceVideoChannelPreviewFromRender } from "@/lib/growth/sequences/growth-sequence-video-send-render"
import type {
  GrowthVideoAutopilotPreviewBundle,
  GrowthVideoAutopilotRecommendation,
} from "@/lib/growth/videos/growth-video-autopilot-types"
import { previewGrowthVideoThumbnail } from "@/lib/growth/videos/growth-video-thumbnail-preview-service"

export function buildGrowthVideoAutopilotPreviewBundle(input: {
  recommendation: GrowthVideoAutopilotRecommendation
  publicUrl?: string | null
}): GrowthVideoAutopilotPreviewBundle {
  const firstName = input.recommendation.inputSnapshot.contactName?.split(/\s+/)[0] ?? "there"
  const publicUrl = input.publicUrl ?? "https://example.com/v/preview"
  const recommended = input.recommendation.recommended

  const thumbnail = previewGrowthVideoThumbnail({
    type: "prospect",
    form: {
      firstName,
      company: input.recommendation.inputSnapshot.companyName ?? "Prospect",
      industry: input.recommendation.inputSnapshot.industry ?? undefined,
      ctaLabel: recommended.ctaLabel ?? "Watch Now",
    },
    pageTitle: recommended.thumbnailText ?? "Personalized Video",
  })

  const channelPreview = buildSequenceVideoChannelPreviewFromRender({
    attachmentType: recommended.channel,
    firstName,
    publicUrl,
    signedThumbnailUrl: thumbnail.previewDataUrl,
    ctaLabel: recommended.ctaLabel,
    ctaUrl: recommended.ctaUrl,
    voiceMediaAssetId: recommended.voiceEnabled ? "preview-voice-asset" : null,
  })

  return {
    recommendationId: input.recommendation.id,
    scriptPreview: recommended.script,
    thumbnailPreviewDataUrl: thumbnail.previewDataUrl,
    overlayPreviewHtml: recommended.overlayText
      ? `<div class="growth-video-autopilot-overlay">${recommended.overlayText}</div>`
      : null,
    channelPreview: {
      emailHtml: channelPreview.emailHtml ?? null,
      smsText: channelPreview.smsText ?? null,
      voiceDropSummary: channelPreview.voiceDropSummary ?? null,
    },
    voicePreviewAvailable: recommended.voiceEnabled,
    avatarPreviewAvailable: recommended.avatarEnabled,
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
  }
}
