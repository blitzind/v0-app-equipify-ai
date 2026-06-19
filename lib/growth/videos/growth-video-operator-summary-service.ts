/** Growth Engine F3 — Operator workspace summary cards (client-safe). */

import type { GrowthVideoAutopilotDraftPackage } from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type {
  GrowthVideoAutopilotRecommendation,
  GrowthVideoAutopilotRecommendationStatus,
} from "@/lib/growth/videos/growth-video-autopilot-types"
import type {
  GrowthVideoOperatorWorkspaceActions,
  GrowthVideoOperatorWorkspaceOperatorState,
  GrowthVideoOperatorWorkspaceSummaryCards,
} from "@/lib/growth/videos/growth-video-operator-workspace-types"

function mediaStatusLabel(
  draft: GrowthVideoAutopilotDraftPackage["voiceDraft"] | GrowthVideoAutopilotDraftPackage["avatarDraft"],
): string {
  if (!draft) return "not_requested"
  if (draft.status === "queued" || draft.queued) return "queued"
  return "draft"
}

export function buildGrowthVideoOperatorSummaryCards(input: {
  draft: GrowthVideoAutopilotDraftPackage
  recommendation: GrowthVideoAutopilotRecommendation | null
  operatorState: GrowthVideoOperatorWorkspaceOperatorState
}): GrowthVideoOperatorWorkspaceSummaryCards {
  const recommendation = input.recommendation
  const pageStatus = input.operatorState.pagePublishedAt
    ? "published"
    : input.draft.pageDraft.videoPageId
      ? input.draft.pageDraft.status
      : "metadata_only"

  return {
    recommendationScore: recommendation?.scores.videoOpportunityScore ?? 0,
    personalizationScore: recommendation?.scores.personalizationScore ?? 0,
    videoType: recommendation?.videoType ?? "unknown",
    priority: recommendation?.scores.recommendedPriority ?? "medium",
    pageStatus,
    attachmentStatus: input.draft.attachmentDraft.attachmentStatus,
    voiceStatus: mediaStatusLabel(input.draft.voiceDraft),
    avatarStatus: mediaStatusLabel(input.draft.avatarDraft),
  }
}

export function buildGrowthVideoOperatorWorkspaceActions(input: {
  draft: GrowthVideoAutopilotDraftPackage
  recommendation: GrowthVideoAutopilotRecommendation | null
  operatorState: GrowthVideoOperatorWorkspaceOperatorState
}): GrowthVideoOperatorWorkspaceActions {
  const recommendationApproved = input.recommendation?.status === "approved"
  const draftReady = input.draft.status === "ready"
  const hasPage = Boolean(input.draft.pageDraft.videoPageId)
  const hasAttachment = Boolean(input.draft.attachmentDraft.sequenceAttachmentId)
  const voiceDraft = input.draft.voiceDraft
  const avatarDraft = input.draft.avatarDraft

  return {
    approveDraft: input.operatorState.draftApprovedAt
      ? "completed"
      : !draftReady || !recommendationApproved
        ? "unavailable"
        : "idle",
    publishPage: input.operatorState.pagePublishedAt
      ? "completed"
      : !hasPage || !input.operatorState.draftApprovedAt
        ? "unavailable"
        : "idle",
    queueVoice: !voiceDraft
      ? "unavailable"
      : input.operatorState.voiceQueuedAt || voiceDraft.status === "queued"
        ? "completed"
        : "idle",
    queueAvatar: !avatarDraft
      ? "unavailable"
      : input.operatorState.avatarQueuedAt || avatarDraft.status === "queued"
        ? "completed"
        : "idle",
    approveAttachment:
      input.draft.attachmentDraft.attachmentStatus === "approved" ||
      input.operatorState.attachmentApprovedAt
        ? "completed"
        : !hasAttachment
          ? "unavailable"
          : "idle",
    discardDraft: input.draft.status === "discarded" ? "completed" : draftReady ? "idle" : "unavailable",
  }
}

export function emptyGrowthVideoOperatorWorkspaceOperatorState(): GrowthVideoOperatorWorkspaceOperatorState {
  return {
    draftApprovedAt: null,
    draftApprovedBy: null,
    pagePublishedAt: null,
    voiceQueuedAt: null,
    avatarQueuedAt: null,
    attachmentApprovedAt: null,
    updatedAt: null,
  }
}

export function recommendationStatusLabel(status: GrowthVideoAutopilotRecommendationStatus | null): string {
  return status ?? "missing"
}
