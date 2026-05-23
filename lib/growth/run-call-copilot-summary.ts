import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthCopilotSettings } from "@/lib/growth/ai-copilot-repository"
import { resolveGrowthCallCopilotRequireSummaryApproval } from "@/lib/growth/call-copilot-settings"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import {
  computeCallOutcomeConfidence,
  suggestCallDisposition,
} from "@/lib/growth/call-copilot-heuristics"
import {
  fetchGrowthCallCopilotSession,
  getCallCopilotBriefing,
  insertGrowthCallBriefEffectiveness,
  updateGrowthCallCopilotSession,
} from "@/lib/growth/call-copilot-repository"
import type { GrowthCallCopilotSession } from "@/lib/growth/call-copilot-types"
import { closeGrowthLeadCallSession } from "@/lib/growth/communication/call-session-repository"
import { recordGrowthLeadCallEvent } from "@/lib/growth/call-events-repository"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { emitGrowthLeadCallCopilotSummaryApprovedTimeline } from "@/lib/growth/timeline-emitter"

function buildCallSummaryContext(session: GrowthCallCopilotSession): string {
  return JSON.stringify(
    {
      liveNotes: session.liveNotes,
      objections: session.detectedObjections.map((entry) => entry.input),
      buyingSignals: session.detectedBuyingSignals.map((signal) => signal.key),
      commitmentSignals: session.detectedCommitmentSignals.map((signal) => signal.key),
      callGoal: session.callGoal,
    },
    null,
    2,
  )
}

export async function runGrowthCallCopilotComplete(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "in_call") throw new Error("invalid_status")

  const briefing = getCallCopilotBriefing(existing)
  const summaryContext = buildCallSummaryContext(existing)

  const generation = await runGrowthAiCopilotGeneration({
    admin,
    leadId: input.leadId,
    generationType: "call_summary",
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    snapshotOverrides: { replyPreview: summaryContext },
  })

  let postCallSummary: string | null = null
  let recommendedNextStep: string | null = null
  let postCallGenerationId: string | null = null

  if (generation.ok) {
    postCallSummary = generation.generation.generatedContent
    recommendedNextStep =
      typeof generation.generation.classification.callPrep?.recommendedCta === "string"
        ? generation.generation.classification.callPrep.recommendedCta
        : briefing?.recommendedCta ?? null
    postCallGenerationId = generation.generation.id !== "ephemeral" ? generation.generation.id : null
  } else {
    postCallSummary = [
      "Call completed (AI summary unavailable).",
      existing.liveNotes ? `Notes: ${existing.liveNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n")
    recommendedNextStep = briefing?.recommendedCta ?? null
  }

  const suggestedDisposition = suggestCallDisposition({
    commitmentSignals: existing.detectedCommitmentSignals,
    buyingSignals: existing.detectedBuyingSignals,
    liveNotes: existing.liveNotes,
  })

  const callOutcomeConfidence = computeCallOutcomeConfidence({
    buyingSignalCount: existing.detectedBuyingSignals.length,
    commitmentSignalCount: existing.detectedCommitmentSignals.length,
    objectionCount: existing.detectedObjections.length,
    suggestedDisposition,
    highRiskCall: briefing?.highRiskCall,
  })

  return updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: {
      status: "completed",
      endedAt: new Date().toISOString(),
      postCallSummary,
      recommendedNextStep,
      suggestedDisposition,
      callOutcomeConfidence,
      postCallGenerationId,
    },
  })
}

export async function approveGrowthCallCopilotSummary(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    approvedBy: string
    actorEmail?: string | null
  },
): Promise<GrowthCallCopilotSession> {
  const settings = await fetchGrowthCopilotSettings(admin)
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "completed") throw new Error("invalid_status")
  if (!existing.postCallSummary) throw new Error("summary_missing")
  if (existing.summaryApprovedAt) throw new Error("already_approved")

  const now = new Date().toISOString()
  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: {
      summaryApprovedAt: now,
      summaryApprovedBy: input.approvedBy,
    },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "summary_approved",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
  })

  if (resolveGrowthCallCopilotRequireSummaryApproval(settings)) {
    await emitGrowthLeadCallCopilotSummaryApprovedTimeline(admin, {
      leadId: input.leadId,
      sessionId: session.id,
      actor: { userId: input.approvedBy, email: input.actorEmail ?? null },
    })
  }

  return session
}

export async function approveGrowthCallCopilotDisposition(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    disposition?: GrowthLeadCallDisposition
    note?: string | null
    followUpAt?: string | null
    approvedBy: string
    actorEmail?: string | null
  },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "completed") throw new Error("invalid_status")
  if (existing.dispositionApprovedAt) throw new Error("already_approved")

  const settings = await fetchGrowthCopilotSettings(admin)
  if (settings.callCopilotRequireSummaryApproval && !existing.summaryApprovedAt) {
    throw new Error("summary_not_approved")
  }

  const disposition = input.disposition ?? existing.suggestedDisposition
  if (!disposition) throw new Error("disposition_required")

  if (existing.callSessionId) {
    await closeGrowthLeadCallSession(admin, {
      leadId: input.leadId,
      sessionId: existing.callSessionId,
      disposition,
      note: input.note ?? existing.postCallSummary,
      followUpAt: input.followUpAt,
      createdBy: input.approvedBy,
      actorEmail: input.actorEmail,
    })
  } else {
    await recordGrowthLeadCallEvent(admin, {
      leadId: input.leadId,
      disposition,
      note: input.note ?? existing.postCallSummary,
      followUpAt: input.followUpAt,
      createdBy: input.approvedBy,
    })
  }

  const now = new Date().toISOString()
  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: {
      dispositionApprovedAt: now,
      dispositionApprovedBy: input.approvedBy,
      suggestedDisposition: disposition,
    },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "disposition_approved",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
    metadata: { disposition },
  })

  logGrowthEngine("call_copilot_disposition_approved", {
    leadId: input.leadId,
    sessionId: input.sessionId,
    disposition,
  })

  return session
}
