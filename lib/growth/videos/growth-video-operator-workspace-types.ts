/** Growth Engine F3 — Video operator workspace types (client-safe). */

import { GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import { GROWTH_VIDEO_AUTOPILOT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-types"
import type {
  GrowthVideoAutopilotChannelPreviewDraft,
  GrowthVideoAutopilotDraftPackage,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type {
  GrowthVideoAutopilotInputSnapshot,
  GrowthVideoAutopilotPreviewBundle,
  GrowthVideoAutopilotRecommendation,
} from "@/lib/growth/videos/growth-video-autopilot-types"

export const GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER = "growth-video-operator-workspace-f3-v1" as const

export const GROWTH_VIDEO_OPERATOR_WORKSPACE_CONFIRM =
  "RUN_GROWTH_VIDEO_OPERATOR_WORKSPACE_CERTIFICATION" as const

export const GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY = "growth_video_autopilot_f3" as const

export type GrowthVideoOperatorWorkspaceActionStatus = "idle" | "completed" | "unavailable"

export type GrowthVideoOperatorWorkspaceSummaryCards = {
  recommendationScore: number
  personalizationScore: number
  videoType: string
  priority: string
  pageStatus: string
  attachmentStatus: string
  voiceStatus: string
  avatarStatus: string
}

export type GrowthVideoOperatorWorkspaceActions = {
  approveDraft: GrowthVideoOperatorWorkspaceActionStatus
  publishPage: GrowthVideoOperatorWorkspaceActionStatus
  queueVoice: GrowthVideoOperatorWorkspaceActionStatus
  queueAvatar: GrowthVideoOperatorWorkspaceActionStatus
  approveAttachment: GrowthVideoOperatorWorkspaceActionStatus
  discardDraft: GrowthVideoOperatorWorkspaceActionStatus
}

export type GrowthVideoOperatorWorkspaceOperatorState = {
  draftApprovedAt: string | null
  draftApprovedBy: string | null
  pagePublishedAt: string | null
  voiceQueuedAt: string | null
  avatarQueuedAt: string | null
  attachmentApprovedAt: string | null
  updatedAt: string | null
}

export type GrowthVideoOperatorWorkspaceView = {
  id: string
  organizationId: string
  leadId: string
  draft: GrowthVideoAutopilotDraftPackage
  recommendation: GrowthVideoAutopilotRecommendation | null
  inputSnapshot: GrowthVideoAutopilotInputSnapshot | null
  preview: GrowthVideoAutopilotPreviewBundle | null
  channelPreview: GrowthVideoAutopilotChannelPreviewDraft
  summary: GrowthVideoOperatorWorkspaceSummaryCards
  actions: GrowthVideoOperatorWorkspaceActions
  operatorState: GrowthVideoOperatorWorkspaceOperatorState
  sourcesUsed: string[]
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
  workerExecutionEnabled: false
}

export type GrowthVideoOperatorWorkspaceMetadata = {
  qa_marker: typeof GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER
  parent_qa_marker: typeof GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER
  grandparent_qa_marker: typeof GROWTH_VIDEO_AUTOPILOT_QA_MARKER
  operatorStates: Record<string, GrowthVideoOperatorWorkspaceOperatorState>
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  worker_execution_enabled: false
}

export type GrowthVideoOperatorWorkspaceListItem = Pick<
  GrowthVideoOperatorWorkspaceView,
  | "id"
  | "organizationId"
  | "leadId"
  | "summary"
  | "actions"
  | "operatorState"
  | "requiresHumanReview"
  | "autonomousExecutionEnabled"
  | "outreachExecution"
  | "enrollmentExecution"
  | "workerExecutionEnabled"
> & {
  draftStatus: GrowthVideoAutopilotDraftPackage["status"]
  recommendationStatus: GrowthVideoAutopilotRecommendation["status"] | null
  contactName: string | null
  companyName: string | null
}

export function growthVideoOperatorWorkspaceSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
    grandparent_qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
    outreach_execution: false as const,
    enrollment_execution: false as const,
    worker_execution_enabled: false as const,
    orchestration_enabled: false as const,
  }
}
