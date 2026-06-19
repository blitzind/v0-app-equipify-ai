/** Growth Engine D1 — Sequence video attachment types (client-safe). */

export const GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER = "growth-sequence-video-attachments-d1-v1" as const

export const GROWTH_SEQUENCE_VIDEO_ATTACHMENT_CONFIRM =
  "RUN_GROWTH_SEQUENCE_VIDEO_ATTACHMENT_CERTIFICATION" as const

export const GROWTH_SEQUENCE_VIDEO_ATTACHMENT_MIGRATION =
  "20270828190000_growth_sequence_video_attachments_d1.sql" as const

export const GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES = ["email", "sms", "voice_drop"] as const

export type GrowthSequenceVideoAttachmentType = (typeof GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES)[number]

export const GROWTH_SEQUENCE_VIDEO_ATTACHMENT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "removed",
] as const

export type GrowthSequenceVideoAttachmentStatus =
  (typeof GROWTH_SEQUENCE_VIDEO_ATTACHMENT_STATUSES)[number]

export type GrowthSequenceVideoAttachmentMetadataHooks = {
  video_asset_id?: string | null
  video_page_id?: string | null
  thumbnail_url?: string | null
  voice_media_asset_id?: string | null
  avatar_media_asset_id?: string | null
  script_version_id?: string | null
  lead_id?: string | null
  company_candidate_id?: string | null
  person_candidate_id?: string | null
  sequence_candidate_id?: string | null
}

export type GrowthSequenceVideoAttachmentAnalyticsHooks = {
  sequence_execution_id?: string | null
  sequence_step_id?: string | null
  email_send_id?: string | null
  sms_send_id?: string | null
  voice_drop_id?: string | null
  video_page_visit_id?: string | null
  engagement_summary_id?: string | null
}

export type GrowthSequenceVideoAttachmentAiPayload = {
  attachment_type: GrowthSequenceVideoAttachmentType
  video_asset_id: string | null
  video_page_id: string | null
  thumbnail_url: string | null
  voice_media_asset_id: string | null
  avatar_media_asset_id: string | null
  sequence_step_id: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type GrowthSequenceVideoAttachmentRecord = {
  id: string
  organizationId: string
  automationFlowId: string | null
  automationNodeId: string | null
  sequencePatternStepId: string | null
  attachmentType: GrowthSequenceVideoAttachmentType
  attachmentStatus: GrowthSequenceVideoAttachmentStatus
  videoAssetId: string | null
  videoPageId: string | null
  voiceMediaAssetId: string | null
  avatarMediaAssetId: string | null
  thumbnailUrl: string | null
  metadataHooks: GrowthSequenceVideoAttachmentMetadataHooks
  analyticsHooks: GrowthSequenceVideoAttachmentAnalyticsHooks
  aiPayload: GrowthSequenceVideoAttachmentAiPayload
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSequenceVideoAssetCatalogItem = {
  id: string
  kind: "video_asset" | "video_page" | "voice_media" | "avatar_media" | "thumbnail"
  title: string
  subtitle: string | null
  videoAssetId: string | null
  videoPageId: string | null
  mediaAssetId: string | null
  thumbnailUrl: string | null
  publicPath: string | null
  dryRun: boolean
}

export type GrowthSequenceVideoChannelPreview = {
  channel: GrowthSequenceVideoAttachmentType
  emailHtml?: string | null
  smsText?: string | null
  voiceDropSummary?: string | null
}

export type GrowthSequenceVideoAttachmentView = GrowthSequenceVideoAttachmentRecord & {
  channelPreview: GrowthSequenceVideoChannelPreview | null
  catalogSummary: {
    videoPageTitle: string | null
    videoPageSlug: string | null
    publicPath: string | null
  }
}

export const GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER =
  "growth-sequence-video-send-builders-d2-v1" as const

export const GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_CONFIRM =
  "RUN_GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_CERTIFICATION" as const

export const GROWTH_SEQUENCE_VIDEO_D3_SIGNALS = [
  "video_viewed",
  "video_high_intent",
  "video_cta_clicked",
  "video_calendar_clicked",
  "video_return_visitor",
  "video_completed",
  "video_multiple_sessions",
] as const

export type GrowthSequenceVideoD3Signal = (typeof GROWTH_SEQUENCE_VIDEO_D3_SIGNALS)[number]

export type GrowthSequenceVideoSendAttribution = {
  attachmentId: string
  videoAssetId: string | null
  videoPageId: string | null
  thumbnailUrl: string | null
  voiceMediaAssetId: string | null
  avatarMediaAssetId: string | null
  publicUrl: string | null
  metadataHooks: GrowthSequenceVideoAttachmentMetadataHooks
  analyticsHooks: GrowthSequenceVideoAttachmentAnalyticsHooks
  aiPayload: GrowthSequenceVideoAttachmentAiPayload
  d3Signals: GrowthSequenceVideoD3Signal[]
}
