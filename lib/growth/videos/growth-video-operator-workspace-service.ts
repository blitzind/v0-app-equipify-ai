/** Growth Engine F3 — Video operator workspace assembly (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { getGrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-recommendation-service"
import {
  getGrowthVideoAutopilotDraft,
  listGrowthVideoAutopilotDrafts,
} from "@/lib/growth/videos/growth-video-autopilot-draft-service"
import { buildGrowthVideoAutopilotPreviewBundle } from "@/lib/growth/videos/growth-video-autopilot-preview-service"
import {
  buildGrowthVideoOperatorSummaryCards,
  buildGrowthVideoOperatorWorkspaceActions,
  emptyGrowthVideoOperatorWorkspaceOperatorState,
} from "@/lib/growth/videos/growth-video-operator-summary-service"
import {
  GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY,
  GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
  type GrowthVideoOperatorWorkspaceListItem,
  type GrowthVideoOperatorWorkspaceMetadata,
  type GrowthVideoOperatorWorkspaceOperatorState,
  type GrowthVideoOperatorWorkspaceView,
} from "@/lib/growth/videos/growth-video-operator-workspace-types"

function emptyOperatorMetadata(): GrowthVideoOperatorWorkspaceMetadata {
  return {
    qa_marker: GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: "growth-video-autopilot-draft-f2-v1",
    grandparent_qa_marker: "growth-video-autopilot-f1-v1",
    operatorStates: {},
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    worker_execution_enabled: false,
  }
}

export function parseGrowthVideoOperatorWorkspaceMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthVideoOperatorWorkspaceMetadata {
  const raw = leadMetadata?.[GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY]
  if (!raw || typeof raw !== "object") return emptyOperatorMetadata()

  const record = raw as Record<string, unknown>
  const operatorStates =
    record.operatorStates && typeof record.operatorStates === "object"
      ? (record.operatorStates as Record<string, GrowthVideoOperatorWorkspaceOperatorState>)
      : {}

  return {
    qa_marker: GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: "growth-video-autopilot-draft-f2-v1",
    grandparent_qa_marker: "growth-video-autopilot-f1-v1",
    operatorStates,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    worker_execution_enabled: false,
  }
}

export async function persistGrowthVideoOperatorWorkspaceMetadata(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    metadata: GrowthVideoOperatorWorkspaceMetadata
  },
): Promise<GrowthVideoOperatorWorkspaceMetadata> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const existing = (lead.metadata ?? {}) as Record<string, unknown>
  await updateGrowthLeadFromImportMerge(admin, input.leadId, {
    metadata: {
      ...existing,
      [GROWTH_VIDEO_OPERATOR_WORKSPACE_METADATA_KEY]: input.metadata,
    },
  })

  return input.metadata
}

export function getGrowthVideoOperatorWorkspaceOperatorState(
  metadata: GrowthVideoOperatorWorkspaceMetadata,
  draftId: string,
): GrowthVideoOperatorWorkspaceOperatorState {
  return metadata.operatorStates[draftId] ?? emptyGrowthVideoOperatorWorkspaceOperatorState()
}

export async function patchGrowthVideoOperatorWorkspaceOperatorState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    draftId: string
    patch: Partial<GrowthVideoOperatorWorkspaceOperatorState>
  },
): Promise<GrowthVideoOperatorWorkspaceOperatorState> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const metadata = parseGrowthVideoOperatorWorkspaceMetadata(lead.metadata)
  const current = getGrowthVideoOperatorWorkspaceOperatorState(metadata, input.draftId)
  const next: GrowthVideoOperatorWorkspaceOperatorState = {
    ...current,
    ...input.patch,
    updatedAt: new Date().toISOString(),
  }

  await persistGrowthVideoOperatorWorkspaceMetadata(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    metadata: {
      ...metadata,
      operatorStates: {
        ...metadata.operatorStates,
        [input.draftId]: next,
      },
    },
  })

  return next
}

async function assembleGrowthVideoOperatorWorkspaceView(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string },
): Promise<GrowthVideoOperatorWorkspaceView | null> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const draft = await getGrowthVideoAutopilotDraft(admin, input)
  if (!draft) return null

  const recommendation = await getGrowthVideoAutopilotRecommendation(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    recommendationId: draft.recommendationId,
  })

  const operatorMetadata = parseGrowthVideoOperatorWorkspaceMetadata(lead.metadata)
  const operatorState = getGrowthVideoOperatorWorkspaceOperatorState(operatorMetadata, draft.id)
  const summary = buildGrowthVideoOperatorSummaryCards({ draft, recommendation, operatorState })
  const actions = buildGrowthVideoOperatorWorkspaceActions({ draft, recommendation, operatorState })
  const preview = recommendation ? buildGrowthVideoAutopilotPreviewBundle({ recommendation }) : null

  return {
    id: draft.id,
    organizationId: input.organizationId,
    leadId: input.leadId,
    draft,
    recommendation,
    inputSnapshot: recommendation?.inputSnapshot ?? null,
    preview,
    channelPreview: draft.channelPreviewDraft,
    summary,
    actions,
    operatorState,
    sourcesUsed: [
      ...new Set([
        ...draft.sourcesUsed,
        ...(recommendation?.sourcesUsed ?? []),
        "f3_operator_workspace",
      ]),
    ],
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
    outreachExecution: false,
    enrollmentExecution: false,
    workerExecutionEnabled: false,
  }
}

export async function listGrowthVideoOperatorWorkspaces(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthVideoOperatorWorkspaceListItem[]> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const drafts = await listGrowthVideoAutopilotDrafts(admin, input)
  const operatorMetadata = parseGrowthVideoOperatorWorkspaceMetadata(lead.metadata)

  const items: GrowthVideoOperatorWorkspaceListItem[] = []

  for (const draft of drafts) {
    const recommendation = await getGrowthVideoAutopilotRecommendation(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      recommendationId: draft.recommendationId,
    })
    const operatorState = getGrowthVideoOperatorWorkspaceOperatorState(operatorMetadata, draft.id)
    const summary = buildGrowthVideoOperatorSummaryCards({ draft, recommendation, operatorState })
    const actions = buildGrowthVideoOperatorWorkspaceActions({ draft, recommendation, operatorState })

    items.push({
      id: draft.id,
      organizationId: input.organizationId,
      leadId: input.leadId,
      draftStatus: draft.status,
      recommendationStatus: recommendation?.status ?? null,
      contactName: recommendation?.inputSnapshot.contactName ?? null,
      companyName: recommendation?.inputSnapshot.companyName ?? null,
      summary,
      actions,
      operatorState,
      requiresHumanReview: true,
      autonomousExecutionEnabled: false,
      outreachExecution: false,
      enrollmentExecution: false,
      workerExecutionEnabled: false,
    })
  }

  return items
}

export async function getGrowthVideoOperatorWorkspace(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; draftId: string },
): Promise<GrowthVideoOperatorWorkspaceView | null> {
  return assembleGrowthVideoOperatorWorkspaceView(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    draftId: input.draftId,
  })
}
