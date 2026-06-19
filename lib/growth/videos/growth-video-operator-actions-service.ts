/** Growth Engine F3 — Operator workspace actions (server-only, metadata-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { approveGrowthSequenceVideoAttachment } from "@/lib/growth/sequences/growth-sequence-video-approval-service"
import {
  discardGrowthVideoAutopilotDraft,
  getGrowthVideoAutopilotDraft,
  patchGrowthVideoAutopilotDraftPackage,
} from "@/lib/growth/videos/growth-video-autopilot-draft-service"
import { getGrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-recommendation-service"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import {
  getGrowthVideoOperatorWorkspace,
  patchGrowthVideoOperatorWorkspaceOperatorState,
} from "@/lib/growth/videos/growth-video-operator-workspace-service"
import type { GrowthVideoOperatorWorkspaceView } from "@/lib/growth/videos/growth-video-operator-workspace-types"

async function reloadWorkspace(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string },
): Promise<GrowthVideoOperatorWorkspaceView> {
  const workspace = await getGrowthVideoOperatorWorkspace(admin, input)
  if (!workspace) throw new Error("not_found")
  return workspace
}

export async function approveGrowthVideoOperatorDraft(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string; actorUserId: string },
): Promise<GrowthVideoOperatorWorkspaceView> {
  const draft = await getGrowthVideoAutopilotDraft(admin, input)
  if (!draft) throw new Error("not_found")
  if (draft.status !== "ready") throw new Error("draft_not_ready")

  const recommendation = await getGrowthVideoAutopilotRecommendation(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    recommendationId: draft.recommendationId,
  })
  if (!recommendation || recommendation.status !== "approved") {
    throw new Error("recommendation_not_approved")
  }

  await patchGrowthVideoOperatorWorkspaceOperatorState(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draftId: input.draftId,
    patch: {
      draftApprovedAt: new Date().toISOString(),
      draftApprovedBy: input.actorUserId,
    },
  })

  return reloadWorkspace(admin, input)
}

export async function publishGrowthVideoOperatorPage(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string; actorUserId: string },
): Promise<GrowthVideoOperatorWorkspaceView> {
  const draft = await getGrowthVideoAutopilotDraft(admin, input)
  if (!draft) throw new Error("not_found")
  if (!draft.pageDraft.videoPageId) throw new Error("page_not_available")

  const pageService = createGrowthVideoPageService(admin)
  try {
    await pageService.publishPage({
      organizationId: input.organizationId,
      pageId: draft.pageDraft.videoPageId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === "video_not_ready") {
      await pageService.updatePage({
        organizationId: input.organizationId,
        pageId: draft.pageDraft.videoPageId,
        patch: {
          status: "published",
          metadata: {
            ...draft.pageDraft.metadata,
            growth_video_operator_f3: {
              published_by: input.actorUserId,
              published_at: new Date().toISOString(),
              operator_publish_only: true,
              outreach_execution: false,
            },
          },
        },
      })
    } else {
      throw error
    }
  }

  await patchGrowthVideoAutopilotDraftPackage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft: {
      ...draft,
      pageDraft: {
        ...draft.pageDraft,
        published: true,
        metadata: {
          ...draft.pageDraft.metadata,
          operator_published_at: new Date().toISOString(),
          operator_published_by: input.actorUserId,
        },
      },
      updatedAt: new Date().toISOString(),
    },
  })

  await patchGrowthVideoOperatorWorkspaceOperatorState(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draftId: input.draftId,
    patch: {
      pagePublishedAt: new Date().toISOString(),
    },
  })

  return reloadWorkspace(admin, input)
}

export async function queueGrowthVideoOperatorMedia(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    draftId: string
    actorUserId: string
    mediaType: "voice" | "avatar" | "both"
  },
): Promise<GrowthVideoOperatorWorkspaceView> {
  const draft = await getGrowthVideoAutopilotDraft(admin, input)
  if (!draft) throw new Error("not_found")

  const now = new Date().toISOString()
  let voiceDraft = draft.voiceDraft
  let avatarDraft = draft.avatarDraft

  if ((input.mediaType === "voice" || input.mediaType === "both") && voiceDraft) {
    voiceDraft = {
      ...voiceDraft,
      status: "queued",
      queued: true,
      notes: "F3 operator queued voice draft — worker execution remains disabled until manual run.",
      metadataHooks: {
        ...voiceDraft.metadataHooks,
        queued_by: input.actorUserId,
        queued_at: now,
      },
    }
  }

  if ((input.mediaType === "avatar" || input.mediaType === "both") && avatarDraft) {
    avatarDraft = {
      ...avatarDraft,
      status: "queued",
      queued: true,
      notes: "F3 operator queued avatar draft — worker execution remains disabled until manual run.",
      metadataHooks: {
        ...avatarDraft.metadataHooks,
        queued_by: input.actorUserId,
        queued_at: now,
      },
    }
  }

  if (
    (input.mediaType === "voice" && !voiceDraft) ||
    (input.mediaType === "avatar" && !avatarDraft) ||
    (input.mediaType === "both" && !voiceDraft && !avatarDraft)
  ) {
    throw new Error("media_draft_not_available")
  }

  await patchGrowthVideoAutopilotDraftPackage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft: {
      ...draft,
      voiceDraft,
      avatarDraft,
      workerExecutionEnabled: false,
      updatedAt: now,
    },
  })

  await patchGrowthVideoOperatorWorkspaceOperatorState(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draftId: input.draftId,
    patch: {
      voiceQueuedAt: voiceDraft?.queued ? now : undefined,
      avatarQueuedAt: avatarDraft?.queued ? now : undefined,
    },
  })

  return reloadWorkspace(admin, input)
}

export async function approveGrowthVideoOperatorAttachment(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string; actorUserId: string },
): Promise<GrowthVideoOperatorWorkspaceView> {
  const draft = await getGrowthVideoAutopilotDraft(admin, input)
  if (!draft) throw new Error("not_found")

  const attachmentId = draft.attachmentDraft.sequenceAttachmentId
  if (!attachmentId) throw new Error("attachment_not_available")

  await approveGrowthSequenceVideoAttachment(admin, {
    organizationId: input.organizationId,
    attachmentId,
    approvedBy: input.actorUserId,
  })

  await patchGrowthVideoAutopilotDraftPackage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft: {
      ...draft,
      attachmentDraft: {
        ...draft.attachmentDraft,
        attachmentStatus: "approved",
      },
      updatedAt: new Date().toISOString(),
    },
  })

  await patchGrowthVideoOperatorWorkspaceOperatorState(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draftId: input.draftId,
    patch: {
      attachmentApprovedAt: new Date().toISOString(),
    },
  })

  return reloadWorkspace(admin, input)
}

export async function discardGrowthVideoOperatorDraft(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string },
): Promise<GrowthVideoOperatorWorkspaceView> {
  await discardGrowthVideoAutopilotDraft(admin, input)
  const workspace = await getGrowthVideoOperatorWorkspace(admin, input)
  if (!workspace) throw new Error("not_found")
  return workspace
}
