import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthCopilotSettings } from "@/lib/growth/ai-copilot-repository"
import {
  GROWTH_CALL_COPILOT_DISABLED_CODE,
  resolveGrowthCallCopilotEnabled,
} from "@/lib/growth/call-copilot-settings"
import { buildGrowthCallCopilotBriefing } from "@/lib/growth/call-copilot-briefing"
import {
  fetchGrowthCallCopilotSession,
  getCallCopilotBriefing,
  insertGrowthCallBriefEffectiveness,
  insertGrowthCallCopilotSession,
  listGrowthCallCopilotSessionsForLead,
  updateGrowthCallCopilotSession,
} from "@/lib/growth/call-copilot-repository"
import type {
  GrowthCallCopilotBuyingSignalKey,
  GrowthCallCopilotCommitmentSignalKey,
  GrowthCallCopilotSession,
} from "@/lib/growth/call-copilot-types"
import {
  GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS,
  GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS,
} from "@/lib/growth/call-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  emitGrowthLeadCallCopilotSessionStartedTimeline,
  emitGrowthLeadCallCopilotSessionCompletedTimeline,
} from "@/lib/growth/timeline-emitter"
import { runGrowthCallCopilotComplete } from "@/lib/growth/run-call-copilot-summary"

export async function createGrowthCallCopilotPrepSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    callSessionId?: string | null
    callGoal?: string | null
    createdBy: string
    actorEmail?: string | null
  },
): Promise<GrowthCallCopilotSession> {
  const settings = await fetchGrowthCopilotSettings(admin)
  if (!resolveGrowthCallCopilotEnabled(settings)) {
    throw new Error(GROWTH_CALL_COPILOT_DISABLED_CODE)
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")

  const briefing = await buildGrowthCallCopilotBriefing(admin, lead)
  const session = await insertGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    callSessionId: input.callSessionId ?? null,
    callGoal: input.callGoal ?? null,
    briefing,
    createdBy: input.createdBy,
  })

  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "briefing_viewed",
    highRiskCall: briefing.highRiskCall,
    callOutcomeConfidence: 0,
  })

  logGrowthEngine("call_copilot_prep_created", { leadId: input.leadId, sessionId: session.id })
  return session
}

export async function startGrowthCallCopilotSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    createdBy: string
    actorEmail?: string | null
  },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "pre_call") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: { status: "in_call", startedAt: now },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "session_started",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
  })

  await emitGrowthLeadCallCopilotSessionStartedTimeline(admin, {
    leadId: input.leadId,
    sessionId: session.id,
    highRiskCall: briefing?.highRiskCall ?? false,
    actor: { userId: input.createdBy, email: input.actorEmail ?? null },
  })

  return session
}

export async function updateGrowthCallCopilotLiveNotes(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string; liveNotes: string },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status === "completed" || existing.status === "discarded") throw new Error("session_closed")

  return updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: { liveNotes: input.liveNotes },
  })
}

export async function captureGrowthCallCopilotBuyingSignal(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    signalKey: GrowthCallCopilotBuyingSignalKey
    note?: string | null
    capturedBy: string
  },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "in_call") throw new Error("invalid_status")

  const captured = [
    ...existing.detectedBuyingSignals,
    {
      key: input.signalKey,
      label: GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS[input.signalKey],
      note: input.note ?? null,
      capturedAt: new Date().toISOString(),
      capturedBy: input.capturedBy,
    },
  ]

  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: { detectedBuyingSignals: captured },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "signal_captured",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
    metadata: { signalType: "buying", signalKey: input.signalKey },
  })

  return session
}

export async function captureGrowthCallCopilotCommitmentSignal(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    signalKey: GrowthCallCopilotCommitmentSignalKey
    note?: string | null
    capturedBy: string
  },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "in_call") throw new Error("invalid_status")

  const captured = [
    ...existing.detectedCommitmentSignals,
    {
      key: input.signalKey,
      label: GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS[input.signalKey],
      note: input.note ?? null,
      capturedAt: new Date().toISOString(),
      capturedBy: input.capturedBy,
    },
  ]

  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: { detectedCommitmentSignals: captured },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "signal_captured",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
    metadata: { signalType: "commitment", signalKey: input.signalKey },
  })

  return session
}

export async function discardGrowthCallCopilotSession(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string; discardedBy: string },
): Promise<GrowthCallCopilotSession> {
  const existing = await fetchGrowthCallCopilotSession(admin, input)
  if (!existing) throw new Error("not_found")
  if (existing.status === "completed") throw new Error("session_closed")

  const session = await updateGrowthCallCopilotSession(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    patch: { status: "discarded", endedAt: new Date().toISOString() },
  })

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "session_discarded",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
  })

  return session
}

export async function completeGrowthCallCopilotSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthCallCopilotSession> {
  const session = await runGrowthCallCopilotComplete(admin, input)

  const briefing = getCallCopilotBriefing(session)
  await insertGrowthCallBriefEffectiveness(admin, {
    sessionId: session.id,
    leadId: input.leadId,
    outcome: "session_completed",
    highRiskCall: briefing?.highRiskCall ?? false,
    callOutcomeConfidence: session.callOutcomeConfidence,
  })

  await emitGrowthLeadCallCopilotSessionCompletedTimeline(admin, {
    leadId: input.leadId,
    sessionId: session.id,
    suggestedDisposition: session.suggestedDisposition,
    callOutcomeConfidence: session.callOutcomeConfidence,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return session
}

export { listGrowthCallCopilotSessionsForLead }
