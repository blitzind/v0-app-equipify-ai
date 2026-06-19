/** Growth Engine F2 — Video Autopilot draft package types (client-safe). */

import { GROWTH_VIDEO_AUTOPILOT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-types"

export const GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER = "growth-video-autopilot-draft-f2-v1" as const

export const GROWTH_VIDEO_AUTOPILOT_DRAFT_CONFIRM = "RUN_GROWTH_VIDEO_AUTOPILOT_DRAFT_CERTIFICATION" as const

export const GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY = "growth_video_autopilot_f2" as const

export const GROWTH_VIDEO_AUTOPILOT_DRAFT_STATUSES = [
  "draft",
  "building",
  "ready",
  "discarded",
] as const

export type GrowthVideoAutopilotDraftStatus = (typeof GROWTH_VIDEO_AUTOPILOT_DRAFT_STATUSES)[number]

export type GrowthVideoAutopilotScriptDraft = {
  script: string | null
  hook: string | null
  talkingPoints: string[]
  ctaCopy: string | null
  sourcesUsed: string[]
}

export type GrowthVideoAutopilotThumbnailDraft = {
  thumbnailText: string | null
  previewDataUrl: string | null
  storagePath: string | null
  sourcesUsed: string[]
}

export type GrowthVideoAutopilotOverlayDraft = {
  overlayText: string | null
  previewHtml: string | null
  sourcesUsed: string[]
}

export type GrowthVideoAutopilotPageDraft = {
  videoPageId: string | null
  videoAssetId: string | null
  slug: string | null
  title: string | null
  description: string | null
  status: "draft"
  ctaLabel: string | null
  ctaUrl: string | null
  calendarUrl: string | null
  published: boolean
  metadata: Record<string, unknown>
}

export const GROWTH_VIDEO_AUTOPILOT_MEDIA_JOB_DRAFT_STATUSES = ["draft", "queued"] as const

export type GrowthVideoAutopilotMediaJobDraftStatus =
  (typeof GROWTH_VIDEO_AUTOPILOT_MEDIA_JOB_DRAFT_STATUSES)[number]

export type GrowthVideoAutopilotMediaJobDraft = {
  status: GrowthVideoAutopilotMediaJobDraftStatus
  generationType: "voice" | "avatar"
  queued: boolean
  workerExecutionEnabled: false
  mediaGenerationRunId: string | null
  aiJobId: string | null
  mediaAssetId: string | null
  provider: string | null
  metadataHooks: Record<string, string | null>
  notes: string | null
}

export type GrowthVideoAutopilotAttachmentDraft = {
  sequenceAttachmentId: string | null
  attachmentType: "email" | "sms" | "voice_drop"
  attachmentStatus: "pending_approval" | "approved"
  videoPageId: string | null
  videoAssetId: string | null
  voiceMediaAssetId: string | null
  avatarMediaAssetId: string | null
  thumbnailUrl: string | null
  automationNodeId: string | null
  sequencePatternStepId: string | null
  metadataHooks: Record<string, string | null>
  analyticsHooks: Record<string, string | null>
}

export type GrowthVideoAutopilotChannelPreviewDraft = {
  channel: "email" | "sms" | "voice_drop"
  publicUrl: string | null
  emailHtml: string | null
  smsText: string | null
  voiceDropSummary: string | null
}

export type GrowthVideoAutopilotDraftPackage = {
  id: string
  organizationId: string
  leadId: string
  recommendationId: string
  status: GrowthVideoAutopilotDraftStatus
  createdAt: string
  updatedAt: string
  builtAt: string | null
  discardedAt: string | null
  scriptDraft: GrowthVideoAutopilotScriptDraft
  thumbnailDraft: GrowthVideoAutopilotThumbnailDraft
  overlayDraft: GrowthVideoAutopilotOverlayDraft
  pageDraft: GrowthVideoAutopilotPageDraft
  voiceDraft: GrowthVideoAutopilotMediaJobDraft | null
  avatarDraft: GrowthVideoAutopilotMediaJobDraft | null
  attachmentDraft: GrowthVideoAutopilotAttachmentDraft
  channelPreviewDraft: GrowthVideoAutopilotChannelPreviewDraft
  relationships: {
    recommendationId: string
    videoPageId: string | null
    videoAssetId: string | null
    sequenceAttachmentId: string | null
    voiceMediaGenerationRunId: string | null
    avatarMediaGenerationRunId: string | null
  }
  sourcesUsed: string[]
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
  workerExecutionEnabled: false
}

export type GrowthVideoAutopilotDraftMetadata = {
  qa_marker: typeof GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER
  parent_qa_marker: typeof GROWTH_VIDEO_AUTOPILOT_QA_MARKER
  drafts: GrowthVideoAutopilotDraftPackage[]
  activeDraftId: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  worker_execution_enabled: false
}

export type GrowthVideoAutopilotDraftBuildInput = {
  organizationId: string
  leadId: string
  recommendationId: string
  draftId?: string | null
  videoAssetId?: string | null
  automationNodeId?: string | null
  sequencePatternStepId?: string | null
  automationFlowId?: string | null
  createdBy?: string | null
  publicPreviewUrl?: string | null
}

export function growthVideoAutopilotDraftSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
    parent_qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
    outreach_execution: false as const,
    enrollment_execution: false as const,
    worker_execution_enabled: false as const,
    orchestration_enabled: false as const,
  }
}
