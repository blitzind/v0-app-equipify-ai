/** Growth Engine F2 — Video Autopilot draft orchestration (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { getGrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-recommendation-service"
import { applyGrowthVideoAutopilotAssetDrafts } from "@/lib/growth/videos/growth-video-autopilot-asset-builder"
import {
  buildGrowthVideoAutopilotAttachmentDraft,
  buildGrowthVideoAutopilotAttachmentDraftMetadata,
  buildGrowthVideoAutopilotChannelPreviewDraft,
} from "@/lib/growth/videos/growth-video-autopilot-attachment-builder"
import {
  GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY,
  GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
  type GrowthVideoAutopilotDraftBuildInput,
  type GrowthVideoAutopilotDraftMetadata,
  type GrowthVideoAutopilotDraftPackage,
  type GrowthVideoAutopilotDraftStatus,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import {
  buildGrowthVideoAutopilotAvatarDraft,
  buildGrowthVideoAutopilotVoiceDraft,
} from "@/lib/growth/videos/growth-video-autopilot-media-builder"
import { buildGrowthVideoAutopilotPageDraft } from "@/lib/growth/videos/growth-video-autopilot-page-builder"

const MAX_DRAFTS = 20

function emptyDraftMetadata(): GrowthVideoAutopilotDraftMetadata {
  return {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
    parent_qa_marker: "growth-video-autopilot-f1-v1",
    drafts: [],
    activeDraftId: null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    worker_execution_enabled: false,
  }
}

export function parseGrowthVideoAutopilotDraftMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthVideoAutopilotDraftMetadata {
  const raw = leadMetadata?.[GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY]
  if (!raw || typeof raw !== "object") return emptyDraftMetadata()

  const record = raw as Record<string, unknown>
  const drafts = Array.isArray(record.drafts) ? (record.drafts as GrowthVideoAutopilotDraftPackage[]) : []

  return {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
    parent_qa_marker: "growth-video-autopilot-f1-v1",
    drafts,
    activeDraftId: typeof record.activeDraftId === "string" ? record.activeDraftId : null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    worker_execution_enabled: false,
  }
}

async function persistDraftMetadata(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; metadata: GrowthVideoAutopilotDraftMetadata },
): Promise<GrowthVideoAutopilotDraftMetadata> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const existing = (lead.metadata ?? {}) as Record<string, unknown>
  await updateGrowthLeadFromImportMerge(admin, input.leadId, {
    metadata: {
      ...existing,
      [GROWTH_VIDEO_AUTOPILOT_DRAFT_METADATA_KEY]: input.metadata,
    },
  })

  return input.metadata
}

function createEmptyDraftPackage(input: {
  organizationId: string
  leadId: string
  recommendationId: string
  draftId?: string | null
}): GrowthVideoAutopilotDraftPackage {
  const now = new Date().toISOString()
  return {
    id: input.draftId?.trim() || randomUUID(),
    organizationId: input.organizationId,
    leadId: input.leadId,
    recommendationId: input.recommendationId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    builtAt: null,
    discardedAt: null,
    scriptDraft: {
      script: null,
      hook: null,
      talkingPoints: [],
      ctaCopy: null,
      sourcesUsed: [],
    },
    thumbnailDraft: {
      thumbnailText: null,
      previewDataUrl: null,
      storagePath: null,
      sourcesUsed: [],
    },
    overlayDraft: {
      overlayText: null,
      previewHtml: null,
      sourcesUsed: [],
    },
    pageDraft: {
      videoPageId: null,
      videoAssetId: null,
      slug: null,
      title: null,
      description: null,
      status: "draft",
      ctaLabel: null,
      ctaUrl: null,
      calendarUrl: null,
      published: false,
      metadata: {},
    },
    voiceDraft: null,
    avatarDraft: null,
    attachmentDraft: {
      sequenceAttachmentId: null,
      attachmentType: "email",
      attachmentStatus: "pending_approval",
      videoPageId: null,
      videoAssetId: null,
      voiceMediaAssetId: null,
      avatarMediaAssetId: null,
      thumbnailUrl: null,
      automationNodeId: null,
      sequencePatternStepId: null,
      metadataHooks: {},
      analyticsHooks: {},
    },
    channelPreviewDraft: {
      channel: "email",
      publicUrl: null,
      emailHtml: null,
      smsText: null,
      voiceDropSummary: null,
    },
    relationships: {
      recommendationId: input.recommendationId,
      videoPageId: null,
      videoAssetId: null,
      sequenceAttachmentId: null,
      voiceMediaGenerationRunId: null,
      avatarMediaGenerationRunId: null,
    },
    sourcesUsed: ["f1_recommendation"],
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
    outreachExecution: false,
    enrollmentExecution: false,
    workerExecutionEnabled: false,
  }
}

export async function listGrowthVideoAutopilotDrafts(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthVideoAutopilotDraftPackage[]> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")
  return parseGrowthVideoAutopilotDraftMetadata(lead.metadata).drafts.filter(
    (draft) => draft.status !== "discarded",
  )
}

export async function getGrowthVideoAutopilotDraft(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string },
): Promise<GrowthVideoAutopilotDraftPackage | null> {
  const drafts = await listGrowthVideoAutopilotDrafts(admin, input)
  return drafts.find((draft) => draft.id === input.draftId) ?? null
}

export async function createGrowthVideoAutopilotDraftFromRecommendation(
  admin: SupabaseClient,
  input: GrowthVideoAutopilotDraftBuildInput & { draftId?: string | null },
): Promise<GrowthVideoAutopilotDraftPackage> {
  const recommendation = await getGrowthVideoAutopilotRecommendation(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    recommendationId: input.recommendationId,
  })
  if (!recommendation) throw new Error("not_found")
  if (recommendation.status !== "approved") throw new Error("recommendation_not_approved")

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const metadata = parseGrowthVideoAutopilotDraftMetadata(lead.metadata)
  const existing = metadata.drafts.find(
    (draft) =>
      draft.recommendationId === input.recommendationId && draft.status !== "discarded",
  )
  if (existing) return existing

  const draft = createEmptyDraftPackage({
    organizationId: input.organizationId,
    leadId: input.leadId,
    recommendationId: input.recommendationId,
    draftId: input.draftId,
  })

  const next: GrowthVideoAutopilotDraftMetadata = {
    ...metadata,
    drafts: [draft, ...metadata.drafts].slice(0, MAX_DRAFTS),
    activeDraftId: draft.id,
  }

  await persistDraftMetadata(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    metadata: next,
  })

  return draft
}

export async function buildGrowthVideoAutopilotDraftPackage(
  admin: SupabaseClient,
  input: GrowthVideoAutopilotDraftBuildInput & { draftId: string },
): Promise<GrowthVideoAutopilotDraftPackage> {
  let draft = await getGrowthVideoAutopilotDraft(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draftId: input.draftId,
  })

  if (!draft) {
    draft = await createGrowthVideoAutopilotDraftFromRecommendation(admin, {
      ...input,
      draftId: input.draftId,
    })
  }

  const recommendation = await getGrowthVideoAutopilotRecommendation(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    recommendationId: draft.recommendationId,
  })
  if (!recommendation) throw new Error("not_found")
  if (recommendation.status !== "approved") throw new Error("recommendation_not_approved")

  const buildingDraft: GrowthVideoAutopilotDraftPackage = {
    ...draft,
    status: "building",
    updatedAt: new Date().toISOString(),
  }

  await updateGrowthVideoAutopilotDraftRecord(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft: buildingDraft,
  })

  let built = applyGrowthVideoAutopilotAssetDrafts(buildingDraft, recommendation)
  const pageDraft = await buildGrowthVideoAutopilotPageDraft(admin, {
    build: input,
    recommendation,
  })
  built = {
    ...built,
    pageDraft,
    relationships: {
      ...built.relationships,
      videoPageId: pageDraft.videoPageId,
      videoAssetId: pageDraft.videoAssetId,
    },
    sourcesUsed: [...new Set([...built.sourcesUsed, "a3_video_pages"])],
  }

  const voiceDraft = buildGrowthVideoAutopilotVoiceDraft({
    build: input,
    recommendation,
    videoPageId: pageDraft.videoPageId,
    videoAssetId: pageDraft.videoAssetId,
  })
  const avatarDraft = buildGrowthVideoAutopilotAvatarDraft({
    build: input,
    recommendation,
    videoPageId: pageDraft.videoPageId,
    videoAssetId: pageDraft.videoAssetId,
  })

  const attachmentDraft = await buildGrowthVideoAutopilotAttachmentDraft(admin, {
    build: input,
    recommendation,
    videoPageId: pageDraft.videoPageId,
    videoAssetId: pageDraft.videoAssetId,
    thumbnailUrl: built.thumbnailDraft.previewDataUrl,
  })

  const channelPreviewDraft = buildGrowthVideoAutopilotChannelPreviewDraft({
    recommendation,
    attachmentDraft,
    publicUrl: input.publicPreviewUrl ?? null,
    thumbnailPreviewDataUrl: built.thumbnailDraft.previewDataUrl,
  })

  const readyDraft: GrowthVideoAutopilotDraftPackage = {
    ...built,
    voiceDraft,
    avatarDraft,
    attachmentDraft,
    channelPreviewDraft,
    status: "ready",
    builtAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    relationships: {
      recommendationId: recommendation.id,
      videoPageId: pageDraft.videoPageId,
      videoAssetId: pageDraft.videoAssetId,
      sequenceAttachmentId: attachmentDraft.sequenceAttachmentId,
      voiceMediaGenerationRunId: voiceDraft?.mediaGenerationRunId ?? null,
      avatarMediaGenerationRunId: avatarDraft?.mediaGenerationRunId ?? null,
    },
    sourcesUsed: [
      ...new Set([
        ...built.sourcesUsed,
        "d1_sequence_video_attachments",
        "d2_send_builders",
        "c3_media_generation_jobs_metadata_only",
      ]),
    ],
  }

  await updateGrowthVideoAutopilotDraftRecord(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft: readyDraft,
  })

  return readyDraft
}

async function updateGrowthVideoAutopilotDraftRecord(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    draft: GrowthVideoAutopilotDraftPackage
  },
): Promise<GrowthVideoAutopilotDraftPackage> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const metadata = parseGrowthVideoAutopilotDraftMetadata(lead.metadata)
  const drafts = metadata.drafts.some((entry) => entry.id === input.draft.id)
    ? metadata.drafts.map((entry) => (entry.id === input.draft.id ? input.draft : entry))
    : [input.draft, ...metadata.drafts].slice(0, MAX_DRAFTS)

  await persistDraftMetadata(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    metadata: {
      ...metadata,
      drafts,
      activeDraftId: input.draft.status === "discarded" ? null : input.draft.id,
    },
  })

  return input.draft
}

export async function discardGrowthVideoAutopilotDraft(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string },
): Promise<GrowthVideoAutopilotDraftPackage> {
  const draft = await getGrowthVideoAutopilotDraft(admin, input)
  if (!draft) throw new Error("not_found")

  return updateGrowthVideoAutopilotDraftRecord(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft: {
      ...draft,
      status: "discarded" satisfies GrowthVideoAutopilotDraftStatus,
      discardedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

export async function patchGrowthVideoAutopilotDraftPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    draft: GrowthVideoAutopilotDraftPackage
  },
): Promise<GrowthVideoAutopilotDraftPackage> {
  return updateGrowthVideoAutopilotDraftRecord(admin, input)
}

export { buildGrowthVideoAutopilotAttachmentDraftMetadata }
