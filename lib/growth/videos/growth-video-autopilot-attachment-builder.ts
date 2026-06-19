/** Growth Engine F2 — Sequence attachment draft builder (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { attachGrowthSequenceVideoAsset } from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { buildSequenceVideoChannelPreviewFromRender } from "@/lib/growth/sequences/growth-sequence-video-send-render"
import { buildSequenceVideoAttachmentAnalyticsHooks } from "@/lib/growth/sequences/growth-sequence-video-preview-service"
import type {
  GrowthVideoAutopilotAttachmentDraft,
  GrowthVideoAutopilotChannelPreviewDraft,
  GrowthVideoAutopilotDraftBuildInput,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type { GrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-types"

function firstName(contactName: string | null | undefined): string {
  return contactName?.split(/\s+/)[0]?.trim() || "there"
}

export function buildGrowthVideoAutopilotAttachmentDraftMetadata(input: {
  recommendation: GrowthVideoAutopilotRecommendation
  videoPageId?: string | null
  videoAssetId?: string | null
  build: GrowthVideoAutopilotDraftBuildInput
}): GrowthVideoAutopilotAttachmentDraft {
  return {
    sequenceAttachmentId: null,
    attachmentType: input.recommendation.recommended.channel,
    attachmentStatus: "pending_approval",
    videoPageId: input.videoPageId ?? null,
    videoAssetId: input.videoAssetId ?? input.build.videoAssetId ?? null,
    voiceMediaAssetId: null,
    avatarMediaAssetId: null,
    thumbnailUrl: null,
    automationNodeId: input.build.automationNodeId ?? null,
    sequencePatternStepId: input.build.sequencePatternStepId ?? null,
    metadataHooks: {
      lead_id: input.recommendation.leadId,
      video_page_id: input.videoPageId ?? null,
      video_asset_id: input.videoAssetId ?? input.build.videoAssetId ?? null,
    },
    analyticsHooks: buildSequenceVideoAttachmentAnalyticsHooks({
      sequencePatternStepId: input.build.sequencePatternStepId ?? null,
    }),
  }
}

export async function buildGrowthVideoAutopilotAttachmentDraft(
  admin: SupabaseClient,
  input: {
    build: GrowthVideoAutopilotDraftBuildInput
    recommendation: GrowthVideoAutopilotRecommendation
    videoPageId?: string | null
    videoAssetId?: string | null
    thumbnailUrl?: string | null
  },
): Promise<GrowthVideoAutopilotAttachmentDraft> {
  const metadataDraft = buildGrowthVideoAutopilotAttachmentDraftMetadata({
    recommendation: input.recommendation,
    videoPageId: input.videoPageId,
    videoAssetId: input.videoAssetId,
    build: input.build,
  })

  if (
    !input.build.automationNodeId?.trim() ||
    !input.videoPageId ||
    !(input.videoAssetId ?? input.build.videoAssetId)
  ) {
    return metadataDraft
  }

  const attachment = await attachGrowthSequenceVideoAsset(admin, {
    organizationId: input.build.organizationId,
    createdBy: input.build.createdBy ?? input.build.organizationId,
    automationFlowId: input.build.automationFlowId ?? null,
    automationNodeId: input.build.automationNodeId,
    sequencePatternStepId: input.build.sequencePatternStepId ?? null,
    attachmentType: input.recommendation.recommended.channel,
    videoAssetId: input.videoAssetId ?? input.build.videoAssetId ?? null,
    videoPageId: input.videoPageId,
    thumbnailUrl: input.thumbnailUrl ?? null,
    metadataHooks: metadataDraft.metadataHooks,
  })

  return {
    ...metadataDraft,
    sequenceAttachmentId: attachment.id,
    thumbnailUrl: attachment.thumbnailUrl,
    voiceMediaAssetId: attachment.voiceMediaAssetId,
    avatarMediaAssetId: attachment.avatarMediaAssetId,
  }
}

export function buildGrowthVideoAutopilotChannelPreviewDraft(input: {
  recommendation: GrowthVideoAutopilotRecommendation
  attachmentDraft: GrowthVideoAutopilotAttachmentDraft
  publicUrl?: string | null
  thumbnailPreviewDataUrl?: string | null
}): GrowthVideoAutopilotChannelPreviewDraft {
  const publicUrl = input.publicUrl ?? "https://example.com/v/autopilot-draft"
  const preview = buildSequenceVideoChannelPreviewFromRender({
    attachmentType: input.attachmentDraft.attachmentType,
    firstName: firstName(input.recommendation.inputSnapshot.contactName),
    publicUrl,
    signedThumbnailUrl: input.thumbnailPreviewDataUrl ?? input.attachmentDraft.thumbnailUrl,
    ctaLabel: input.recommendation.recommended.ctaLabel,
    ctaUrl: input.recommendation.recommended.ctaUrl,
    voiceMediaAssetId: input.attachmentDraft.voiceMediaAssetId,
  })

  return {
    channel: input.attachmentDraft.attachmentType,
    publicUrl,
    emailHtml: preview.emailHtml ?? null,
    smsText: preview.smsText ?? null,
    voiceDropSummary: preview.voiceDropSummary ?? null,
  }
}
