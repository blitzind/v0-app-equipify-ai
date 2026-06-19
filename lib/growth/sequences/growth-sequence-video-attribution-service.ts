import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceVideoAttachmentAnalyticsHooks,
  GrowthSequenceVideoAttachmentRecord,
  GrowthSequenceVideoSendAttribution,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import { buildSequenceVideoSendAnalyticsHooks } from "@/lib/growth/sequences/growth-sequence-video-send-render"
import { mapSequenceVideoAttachmentRow } from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { buildSequenceVideoAttachmentAiPayload } from "@/lib/growth/sequences/growth-sequence-video-render-service"

type AnalyticsPatchInput = Partial<GrowthSequenceVideoAttachmentAnalyticsHooks> & {
  attachmentId: string
  organizationId: string
}

export { buildSequenceVideoSendAnalyticsHooks }

export function buildSequenceVideoSendAttribution(input: {
  attachment: GrowthSequenceVideoAttachmentRecord
  publicUrl?: string | null
  signedThumbnailUrl?: string | null
  sequenceExecutionId?: string | null
  enrollmentStepId?: string | null
  d3Signals?: GrowthSequenceVideoSendAttribution["d3Signals"]
}): GrowthSequenceVideoSendAttribution {
  const analyticsHooks = buildSequenceVideoSendAnalyticsHooks({
    attachment: input.attachment,
    sequenceExecutionId: input.sequenceExecutionId,
    enrollmentStepId: input.enrollmentStepId,
  })

  return {
    attachmentId: input.attachment.id,
    videoAssetId: input.attachment.videoAssetId,
    videoPageId: input.attachment.videoPageId,
    thumbnailUrl: input.signedThumbnailUrl ?? input.attachment.thumbnailUrl,
    voiceMediaAssetId: input.attachment.voiceMediaAssetId,
    avatarMediaAssetId: input.attachment.avatarMediaAssetId,
    publicUrl: input.publicUrl ?? null,
    metadataHooks: {
      ...input.attachment.metadataHooks,
      video_asset_id: input.attachment.videoAssetId,
      video_page_id: input.attachment.videoPageId,
      thumbnail_url: input.signedThumbnailUrl ?? input.attachment.thumbnailUrl,
      voice_media_asset_id: input.attachment.voiceMediaAssetId,
      avatar_media_asset_id: input.attachment.avatarMediaAssetId,
    },
    analyticsHooks,
    aiPayload: buildSequenceVideoAttachmentAiPayload({
      attachment: {
        attachmentType: input.attachment.attachmentType,
        videoAssetId: input.attachment.videoAssetId,
        videoPageId: input.attachment.videoPageId,
        thumbnailUrl: input.signedThumbnailUrl ?? input.attachment.thumbnailUrl,
        voiceMediaAssetId: input.attachment.voiceMediaAssetId,
        avatarMediaAssetId: input.attachment.avatarMediaAssetId,
        sequencePatternStepId: input.attachment.sequencePatternStepId,
      },
    }),
    d3Signals: input.d3Signals ?? [],
  }
}

export async function patchSequenceVideoAttachmentAnalyticsHooks(
  admin: SupabaseClient,
  input: AnalyticsPatchInput,
): Promise<GrowthSequenceVideoAttachmentAnalyticsHooks> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.attachmentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("not_found")

  const metadata = (data.metadata_json ?? {}) as Record<string, unknown>
  const existing =
    metadata.analytics_hooks && typeof metadata.analytics_hooks === "object"
      ? (metadata.analytics_hooks as GrowthSequenceVideoAttachmentAnalyticsHooks)
      : {}

  const nextHooks: GrowthSequenceVideoAttachmentAnalyticsHooks = {
    sequence_execution_id:
      input.sequence_execution_id ?? existing.sequence_execution_id ?? null,
    sequence_step_id: input.sequence_step_id ?? existing.sequence_step_id ?? null,
    email_send_id: input.email_send_id ?? existing.email_send_id ?? null,
    sms_send_id: input.sms_send_id ?? existing.sms_send_id ?? null,
    voice_drop_id: input.voice_drop_id ?? existing.voice_drop_id ?? null,
    video_page_visit_id: input.video_page_visit_id ?? existing.video_page_visit_id ?? null,
    engagement_summary_id: input.engagement_summary_id ?? existing.engagement_summary_id ?? null,
  }

  const { error: updateError } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .update({
      metadata_json: {
        ...metadata,
        analytics_hooks: nextHooks,
      },
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.attachmentId)

  if (updateError) throw new Error(updateError.message)
  return nextHooks
}

export async function persistSequenceVideoSendAttribution(
  admin: SupabaseClient,
  input: AnalyticsPatchInput,
): Promise<GrowthSequenceVideoAttachmentAnalyticsHooks> {
  return patchSequenceVideoAttachmentAnalyticsHooks(admin, input)
}

export async function readSequenceVideoAttachmentAnalyticsHooks(
  admin: SupabaseClient,
  input: { organizationId: string; attachmentId: string },
): Promise<GrowthSequenceVideoAttachmentAnalyticsHooks | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.attachmentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const metadata = (data.metadata_json ?? {}) as Record<string, unknown>
  if (!metadata.analytics_hooks || typeof metadata.analytics_hooks !== "object") return null
  return metadata.analytics_hooks as GrowthSequenceVideoAttachmentAnalyticsHooks
}

export async function loadSequenceVideoAttachmentRecord(
  admin: SupabaseClient,
  input: { organizationId: string; attachmentId: string },
): Promise<GrowthSequenceVideoAttachmentRecord | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.attachmentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapSequenceVideoAttachmentRow(data as Record<string, unknown>)
}
