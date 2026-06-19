/** Growth Engine F1 — Video Autopilot recommendation engine (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthAiCopilotInput } from "@/lib/growth/ai-copilot-input"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import {
  deriveGrowthVideoIntelligenceSignals,
  readGrowthVideoCallWorkspaceFromLeadMetadata,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-mappings"
import {
  appendGrowthVideoAutopilotRecommendation,
  getGrowthVideoAutopilotRecommendation,
  listGrowthVideoAutopilotRecommendations,
  updateGrowthVideoAutopilotRecommendationStatus,
} from "@/lib/growth/videos/growth-video-autopilot-recommendation-service"
import { buildGrowthVideoAutopilotPreviewBundle } from "@/lib/growth/videos/growth-video-autopilot-preview-service"
import {
  buildDeterministicGrowthVideoAutopilotRecommendation,
  buildGrowthVideoAutopilotSystemPrompt,
  buildGrowthVideoAutopilotUserPrompt,
  growthVideoAutopilotModelSchema,
  mapGrowthVideoAutopilotModelToRecommended,
} from "@/lib/growth/videos/growth-video-autopilot-prompt-service"
import {
  deriveGrowthVideoAutopilotChannel,
  deriveGrowthVideoAutopilotVideoType,
  scoreGrowthVideoAutopilotOpportunity,
  shouldRecommendGrowthVideoSend,
} from "@/lib/growth/videos/growth-video-autopilot-score-service"
import {
  GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
  growthVideoAutopilotSafetyPayload,
  type GrowthVideoAutopilotInputSnapshot,
  type GrowthVideoAutopilotPreviewBundle,
  type GrowthVideoAutopilotRecommendation,
  type GrowthVideoAutopilotRecommendationStatus,
} from "@/lib/growth/videos/growth-video-autopilot-types"

export {
  getGrowthVideoAutopilotRecommendation,
  listGrowthVideoAutopilotRecommendations,
  updateGrowthVideoAutopilotRecommendationStatus,
} from "@/lib/growth/videos/growth-video-autopilot-recommendation-service"

export { buildGrowthVideoAutopilotPreviewBundle } from "@/lib/growth/videos/growth-video-autopilot-preview-service"

export {
  scoreGrowthVideoAutopilotOpportunity,
  shouldRecommendGrowthVideoSend,
} from "@/lib/growth/videos/growth-video-autopilot-score-service"

function readVideoD3Signals(metadata: Record<string, unknown> | null | undefined): {
  signals: string[]
  engagementScore: number | null
} {
  const raw = metadata?.growth_video_d3
  if (!raw || typeof raw !== "object") return { signals: [], engagementScore: null }
  const record = raw as Record<string, unknown>
  const signals = Array.isArray(record.signals)
    ? record.signals.filter((entry): entry is string => typeof entry === "string")
    : []
  const metrics =
    record.metrics && typeof record.metrics === "object"
      ? (record.metrics as Record<string, unknown>)
      : null
  const engagementScore =
    typeof metrics?.videoEngagementScore === "number" ? metrics.videoEngagementScore : null
  return { signals, engagementScore }
}

export async function buildGrowthVideoAutopilotInputSnapshot(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthVideoAutopilotInputSnapshot> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead || lead.organizationId !== input.organizationId) throw new Error("not_found")

  const [researchRun, decisionMakers, copilotInput] = await Promise.all([
    lead.latestResearchRunId
      ? fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
      : Promise.resolve(null),
    listGrowthLeadDecisionMakers(admin, lead.id),
    buildGrowthAiCopilotInput(admin, lead),
  ])

  const d3 = readVideoD3Signals(lead.metadata as Record<string, unknown> | null | undefined)
  const callWorkspace = readGrowthVideoCallWorkspaceFromLeadMetadata(
    lead.metadata as Record<string, unknown> | null | undefined,
  )

  const painPoints = [
    ...(researchRun?.result?.equipifyPainPoints ?? []),
    ...(researchRun?.result?.outreachAngles ?? []),
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .slice(0, 4)

  const sourcesUsed = [
    "growth.leads",
    researchRun ? "growth.lead_research_runs" : null,
    d3.signals.length > 0 ? "lead.metadata.growth_video_d3" : null,
    callWorkspace ? "lead.metadata.growth_video_d3.call_workspace_context" : null,
    decisionMakers.length > 0 ? "growth.lead_decision_makers" : null,
    "growth_ai_copilot_input",
  ].filter(Boolean) as string[]

  return {
    leadId: lead.id,
    companyName: lead.companyName,
    contactName: lead.contactName,
    industry: researchRun?.result?.likelyServiceCategory ?? null,
    companySize: researchRun?.result?.companySizeEstimate ?? null,
    painPoints,
    fitScore: lead.score,
    momentumScore: lead.momentumScore,
    buyingCommitteeSummary:
      decisionMakers.length > 0
        ? decisionMakers
            .slice(0, 3)
            .map((dm) => `${dm.fullName}${dm.title ? ` (${dm.title})` : ""}`)
            .join("; ")
        : null,
    researchSummary: copilotInput.researchSummary || null,
    engagementSummary: copilotInput.engagementSummary || null,
    relationshipSummary: copilotInput.relationshipMemory.relationshipSummary ?? lead.relationshipSummary,
    nextBestAction: lead.nextBestAction,
    videoIntelligenceSignals: d3.signals.length
      ? d3.signals
      : deriveGrowthVideoIntelligenceSignals({
          totalViews: callWorkspace?.numberOfViews ?? 0,
          highestPercentWatched: callWorkspace?.highestCompletionPercent ?? 0,
          totalCtaClicks: callWorkspace?.ctaClicked ? 1 : 0,
          totalCalendarClicks: callWorkspace?.calendarClicked ? 1 : 0,
          sessionCount: (callWorkspace?.numberOfViews ?? 0) > 1 ? 2 : 1,
        }),
    videoEngagementScore: d3.engagementScore,
    sourcesUsed,
  }
}

async function maybeEnhanceRecommendationWithAi(input: {
  snapshot: GrowthVideoAutopilotInputSnapshot
  scores: ReturnType<typeof scoreGrowthVideoAutopilotOpportunity>
  videoType: ReturnType<typeof deriveGrowthVideoAutopilotVideoType>
  shouldSendVideo: boolean
  channel: ReturnType<typeof deriveGrowthVideoAutopilotChannel>
}): Promise<{
  recommended: ReturnType<typeof buildDeterministicGrowthVideoAutopilotRecommendation>
  aiPayload: Record<string, unknown> | null
  provider: string
}> {
  const deterministic = buildDeterministicGrowthVideoAutopilotRecommendation({
    snapshot: input.snapshot,
    scores: input.scores,
    videoType: input.videoType,
    shouldSendVideo: input.shouldSendVideo,
    channel: input.channel,
  })

  const orgId = getGrowthEngineAiOrgId()
  if (!orgId || !input.shouldSendVideo) {
    return { recommended: deterministic, aiPayload: null, provider: "deterministic_f1" }
  }

  try {
    const result = await runAiTask({
      task: "growth_video_script_generation",
      organizationId: orgId,
      input: {
        system: buildGrowthVideoAutopilotSystemPrompt(),
        user: buildGrowthVideoAutopilotUserPrompt({
          snapshot: input.snapshot,
          scores: input.scores,
          videoType: input.videoType,
          shouldSendVideo: input.shouldSendVideo,
        }),
      },
      schema: growthVideoAutopilotModelSchema,
      cacheSchemaVersion: "growth_video_autopilot_f1_v1",
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      forceLiveAi: false,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!result.ok) {
      return { recommended: deterministic, aiPayload: { fallback: "deterministic", error: result.error.message }, provider: "deterministic_f1" }
    }

    return {
      recommended: mapGrowthVideoAutopilotModelToRecommended(result.output, input.channel),
      aiPayload: {
        model_output: result.output,
        provider: result.meta.provider,
        model: result.meta.model,
        requires_human_review: true,
        autonomous_execution_enabled: false,
      },
      provider: result.meta.provider,
    }
  } catch {
    return { recommended: deterministic, aiPayload: null, provider: "deterministic_f1" }
  }
}

export async function generateGrowthVideoAutopilotRecommendation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    persist?: boolean
    publicPreviewUrl?: string | null
  },
): Promise<{
  recommendation: GrowthVideoAutopilotRecommendation
  preview: GrowthVideoAutopilotPreviewBundle
}> {
  const snapshot = await buildGrowthVideoAutopilotInputSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  const scores = scoreGrowthVideoAutopilotOpportunity(snapshot)
  const shouldSendVideo = shouldRecommendGrowthVideoSend(scores)
  const videoType = deriveGrowthVideoAutopilotVideoType({ snapshot, reasons: scores.reasons })
  const channel = deriveGrowthVideoAutopilotChannel({ scores, snapshot })
  const enhanced = await maybeEnhanceRecommendationWithAi({
    snapshot,
    scores,
    videoType,
    shouldSendVideo,
    channel,
  })

  const baseRecommendation = {
    leadId: input.leadId,
    organizationId: input.organizationId,
    status: "draft" as const,
    shouldSendVideo,
    videoType,
    scores,
    recommended: enhanced.recommended,
    inputSnapshot: snapshot,
    aiPayload: enhanced.aiPayload,
    sourcesUsed: [...snapshot.sourcesUsed, `provider:${enhanced.provider}`],
    requiresHumanReview: true as const,
    autonomousExecutionEnabled: false as const,
    outreachExecution: false as const,
    enrollmentExecution: false as const,
  }

  const recommendation = input.persist === false
    ? {
        ...baseRecommendation,
        id: "preview-only",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
        dismissedAt: null,
        dismissedBy: null,
      }
    : await appendGrowthVideoAutopilotRecommendation(admin, {
        organizationId: input.organizationId,
        recommendation: baseRecommendation,
      })

  const preview = buildGrowthVideoAutopilotPreviewBundle({
    recommendation,
    publicUrl: input.publicPreviewUrl,
  })

  return { recommendation, preview }
}

export async function reviewGrowthVideoAutopilotRecommendation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    recommendationId: string
    status: Extract<GrowthVideoAutopilotRecommendationStatus, "approved" | "dismissed">
    actorUserId?: string | null
  },
): Promise<GrowthVideoAutopilotRecommendation> {
  return updateGrowthVideoAutopilotRecommendationStatus(admin, input)
}

export function growthVideoAutopilotReadinessPayload() {
  return {
    ...growthVideoAutopilotSafetyPayload(),
    execute_confirm: "RUN_GROWTH_VIDEO_AUTOPILOT_CERTIFICATION",
    qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
  }
}
