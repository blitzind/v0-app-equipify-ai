import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import { extractCallIntelligenceSignals } from "@/lib/growth/call-intelligence/call-signal-extractor"
import { buildCallIntelligenceSafeSummary } from "@/lib/growth/call-intelligence/call-intelligence-summary"
import { emitCallIntelligenceNotifications } from "@/lib/growth/call-intelligence/call-intelligence-notifications"
import {
  fetchCallIntelligenceDashboardSummary,
  fetchCallIntelligenceScorecardBySession,
  fetchLatestCallIntelligenceScorecardForLead,
  logCallIntelligence,
  upsertCallIntelligenceScorecard,
} from "@/lib/growth/call-intelligence/call-intelligence-repository"
import { triggerDealIntelligenceFromCallScorecard } from "@/lib/growth/call-intelligence/call-intelligence-deal-bridge"
import { gatherCallScoreInputs } from "@/lib/growth/call-intelligence/call-score-inputs"
import { computeCallIntelligenceScore } from "@/lib/growth/call-intelligence/call-score-engine"
import type {
  CallIntelligenceDashboardSummary,
  CallIntelligenceScorecardPublicView,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import { fetchGrowthMeetingById, fetchGrowthMeetingByRealtimeSessionId } from "@/lib/growth/meeting-intelligence/meeting-repository"

export type GenerateCallIntelligenceScorecardInput = {
  admin: SupabaseClient
  leadId: string
  realtimeSessionId?: string | null
  meetingId?: string | null
  trigger: "session_complete" | "meeting_outcome" | "manual_recompute"
}

export type GenerateCallIntelligenceScorecardResult =
  | { ok: true; scorecard: CallIntelligenceScorecardPublicView; previousScorecard: CallIntelligenceScorecardPublicView | null }
  | { ok: false; code: string; message: string }

export async function generateCallIntelligenceScorecard(
  input: GenerateCallIntelligenceScorecardInput,
): Promise<GenerateCallIntelligenceScorecardResult> {
  try {
    const lead = await fetchGrowthLeadById(input.admin, input.leadId)
    if (!lead) return { ok: false, code: "not_found", message: "Lead not found." }

    let realtimeSessionId = input.realtimeSessionId ?? null
    let meetingId = input.meetingId ?? null

    if (meetingId && !realtimeSessionId) {
      const meeting = await fetchGrowthMeetingById(input.admin, meetingId)
      realtimeSessionId = meeting?.realtimeCallSessionId ?? null
      meetingId = meeting?.id ?? meetingId
    }

    if (!realtimeSessionId) {
      return {
        ok: false,
        code: "insufficient_data",
        message: "No linked live coaching session to score. Complete a call session first.",
      }
    }

    const session = await fetchGrowthRealtimeCallSession(input.admin, realtimeSessionId)
    if (!session) return { ok: false, code: "not_found", message: "Live coaching session not found." }

    const meeting = meetingId
      ? await fetchGrowthMeetingById(input.admin, meetingId)
      : await fetchGrowthMeetingByRealtimeSessionId(input.admin, realtimeSessionId)

    const previousScorecard = await fetchCallIntelligenceScorecardBySession(input.admin, realtimeSessionId)
    const context = await gatherCallScoreInputs(input.admin, {
      leadId: input.leadId,
      realtimeSessionId,
    })

    const signals = extractCallIntelligenceSignals({
      snapshot: session.liveSnapshot,
      nextStepSecured: context.nextStepSecured,
      meetingOutcomeMissing: context.scoreInputs.meetingOutcomeMissing,
      meetingNoShow: context.scoreInputs.meetingNoShow,
    })

    const computed = computeCallIntelligenceScore({
      scoreInputs: context.scoreInputs,
      signals,
      insufficientData: context.insufficientData,
    })

    const safeSummary = buildCallIntelligenceSafeSummary({
      companyName: lead.companyName,
      computed,
      signals,
      riskLevel: computed.riskLevel,
      outcome: computed.outcome,
    })

    const scorecard = await upsertCallIntelligenceScorecard(input.admin, {
      leadId: input.leadId,
      opportunityId: context.opportunityId ?? meeting?.opportunityId ?? null,
      meetingId: meeting?.id ?? null,
      realtimeSessionId,
      ownerUserId: context.ownerUserId ?? lead.assignedTo ?? null,
      computed,
      signals,
      safeSummary,
    })

    await emitCallIntelligenceNotifications(input.admin, {
      leadId: input.leadId,
      companyName: lead.companyName,
      ownerUserId: scorecard.ownerUserId,
      opportunityId: scorecard.opportunityId,
      meetingId: scorecard.meetingId,
      realtimeSessionId,
      scorecard,
      previousScorecard,
    })

    void triggerDealIntelligenceFromCallScorecard(input.admin, {
      leadId: input.leadId,
      opportunityId: scorecard.opportunityId,
      scorecard,
    }).catch(() => undefined)

    logCallIntelligence("scorecard_generated", {
      leadId: input.leadId,
      realtimeSessionId,
      trigger: input.trigger,
      overallScore: scorecard.overallScore,
      riskLevel: scorecard.riskLevel,
    })

    return { ok: true, scorecard, previousScorecard }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logCallIntelligence("scorecard_failed", { leadId: input.leadId, message })
    return { ok: false, code: "generation_failed", message }
  }
}

export async function loadCallIntelligenceForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ latestScorecard: CallIntelligenceScorecardPublicView | null }> {
  const latestScorecard = await fetchLatestCallIntelligenceScorecardForLead(admin, leadId)
  return { latestScorecard }
}

export async function fetchGrowthCallIntelligenceDashboard(
  admin: SupabaseClient,
): Promise<CallIntelligenceDashboardSummary> {
  return fetchCallIntelligenceDashboardSummary(admin)
}
