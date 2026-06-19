/** Growth Engine F1 — Video Autopilot recommendation metadata (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import {
  GROWTH_VIDEO_AUTOPILOT_METADATA_KEY,
  GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
  type GrowthVideoAutopilotMetadata,
  type GrowthVideoAutopilotRecommendation,
  type GrowthVideoAutopilotRecommendationStatus,
} from "@/lib/growth/videos/growth-video-autopilot-types"

const MAX_RECOMMENDATIONS = 20

function emptyAutopilotMetadata(): GrowthVideoAutopilotMetadata {
  return {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
    recommendations: [],
    activeRecommendationId: null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

export function parseGrowthVideoAutopilotMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthVideoAutopilotMetadata {
  const raw = leadMetadata?.[GROWTH_VIDEO_AUTOPILOT_METADATA_KEY]
  if (!raw || typeof raw !== "object") return emptyAutopilotMetadata()

  const record = raw as Record<string, unknown>
  const recommendations = Array.isArray(record.recommendations)
    ? (record.recommendations as GrowthVideoAutopilotRecommendation[])
    : []

  return {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
    recommendations,
    activeRecommendationId:
      typeof record.activeRecommendationId === "string" ? record.activeRecommendationId : null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

async function persistAutopilotMetadata(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    metadata: GrowthVideoAutopilotMetadata
  },
): Promise<GrowthVideoAutopilotMetadata> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const existing = (lead.metadata ?? {}) as Record<string, unknown>
  await updateGrowthLeadFromImportMerge(admin, input.leadId, {
    metadata: {
      ...existing,
      [GROWTH_VIDEO_AUTOPILOT_METADATA_KEY]: input.metadata,
    },
  })

  return input.metadata
}

export async function listGrowthVideoAutopilotRecommendations(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthVideoAutopilotRecommendation[]> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")
  return parseGrowthVideoAutopilotMetadata(lead.metadata).recommendations
}

export async function getGrowthVideoAutopilotRecommendation(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; recommendationId: string },
): Promise<GrowthVideoAutopilotRecommendation | null> {
  const recommendations = await listGrowthVideoAutopilotRecommendations(admin, input)
  return recommendations.find((entry) => entry.id === input.recommendationId) ?? null
}

export async function appendGrowthVideoAutopilotRecommendation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recommendation: Omit<
      GrowthVideoAutopilotRecommendation,
      "id" | "createdAt" | "updatedAt" | "approvedAt" | "approvedBy" | "dismissedAt" | "dismissedBy"
    >
  },
): Promise<GrowthVideoAutopilotRecommendation> {
  const lead = await fetchGrowthLeadById(admin, input.recommendation.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const metadata = parseGrowthVideoAutopilotMetadata(lead.metadata)
  const now = new Date().toISOString()
  const recommendation: GrowthVideoAutopilotRecommendation = {
    ...input.recommendation,
    id: randomUUID(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    approvedBy: null,
    dismissedAt: null,
    dismissedBy: null,
  }

  const next: GrowthVideoAutopilotMetadata = {
    ...metadata,
    recommendations: [recommendation, ...metadata.recommendations].slice(0, MAX_RECOMMENDATIONS),
    activeRecommendationId: recommendation.id,
  }

  await persistAutopilotMetadata(admin, {
    organizationId: input.organizationId,
    leadId: input.recommendation.leadId,
    metadata: next,
  })

  return recommendation
}

export async function updateGrowthVideoAutopilotRecommendationStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    recommendationId: string
    status: GrowthVideoAutopilotRecommendationStatus
    actorUserId?: string | null
  },
): Promise<GrowthVideoAutopilotRecommendation> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const metadata = parseGrowthVideoAutopilotMetadata(lead.metadata)
  const now = new Date().toISOString()
  let updated: GrowthVideoAutopilotRecommendation | null = null

  const recommendations = metadata.recommendations.map((entry) => {
    if (entry.id !== input.recommendationId) return entry
    updated = {
      ...entry,
      status: input.status,
      updatedAt: now,
      approvedAt: input.status === "approved" ? now : entry.approvedAt,
      approvedBy: input.status === "approved" ? input.actorUserId ?? null : entry.approvedBy,
      dismissedAt: input.status === "dismissed" ? now : entry.dismissedAt,
      dismissedBy: input.status === "dismissed" ? input.actorUserId ?? null : entry.dismissedBy,
    }
    return updated
  })

  if (!updated) throw new Error("not_found")

  await persistAutopilotMetadata(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    metadata: {
      ...metadata,
      recommendations,
      activeRecommendationId:
        input.status === "dismissed" && metadata.activeRecommendationId === input.recommendationId
          ? null
          : metadata.activeRecommendationId,
    },
  })

  return updated
}
