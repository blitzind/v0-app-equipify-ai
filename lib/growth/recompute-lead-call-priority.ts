import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { computeGrowthCallPriority, type CallPriorityResult } from "@/lib/growth/call-priority"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  fetchGrowthLeadResearchNotes,
  fetchLatestUsableGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import {
  fetchMeetingIntentPending,
  fetchPendingOpportunityRecommendationScore,
  fetchReplyUrgencyBoost,
} from "@/lib/growth/revenue-workflow/revenue-workflow-signals"
import {
  readRevenueReadinessFromLeadMetadata,
  type GrowthRevenueReadinessSnapshot,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import { emitGrowthLeadPriorityChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function computeGrowthLeadCallPriorityResult(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<CallPriorityResult> {
  const [latestRun, manualNotes, memory, opportunityRecScore, replyUrgencyBoost, meetingIntentPending, emailSummary] =
    await Promise.all([
      lead.latestResearchRunId
        ? fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
        : Promise.resolve(null),
      fetchGrowthLeadResearchNotes(admin, lead.id),
      buildLeadMemoryInfluenceContext(admin, lead.id).catch(() => null),
      fetchPendingOpportunityRecommendationScore(admin, lead.id),
      fetchReplyUrgencyBoost(admin, lead.id),
      fetchMeetingIntentPending(admin, lead.id),
      fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail),
    ])

  const revenueReadiness = readRevenueReadinessFromLeadMetadata(lead.metadata) as GrowthRevenueReadinessSnapshot | null

  return computeGrowthCallPriority({
    researchPriority: lead.researchPriority,
    score: lead.score,
    status: lead.status,
    lastResearchedAt: lead.lastResearchedAt,
    recommendedNextAction: latestRun?.result?.recommendedNextAction ?? null,
    leadNotes: lead.notes,
    manualResearchNotes: manualNotes?.body ?? null,
    callDisposition: lead.callDisposition,
    followUpAt: lead.followUpAt,
    callPriorityOverride: lead.callPriorityOverride,
    emailSummary,
    revenueReadinessScore: revenueReadiness?.score ?? null,
    revenueReadinessTier: revenueReadiness?.tier ?? null,
    opportunityRecommendationScore: opportunityRecScore,
    replyUrgencyBoost,
    engagementTrend: memory?.engagementTrend ?? lead.relationshipTrend,
    meetingIntentPending,
  })
}

export async function recomputeGrowthLeadCallPriority(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const priority = await computeGrowthLeadCallPriorityResult(admin, lead)

  const now = new Date().toISOString()
  const { error } = await growthLeadsTable(admin)
    .update({
      call_priority_score: priority.effectiveScore,
      call_priority_tier: priority.tier,
      call_priority_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("call_priority_recompute_failed", {
      leadId,
      message: error.message,
    })
    throw new Error(error.message)
  }

  if (
    lead.callPriorityScore !== priority.effectiveScore ||
    lead.callPriorityTier !== priority.tier
  ) {
    await emitGrowthLeadPriorityChangedTimeline(admin, {
      leadId,
      fromScore: lead.callPriorityScore,
      toScore: priority.effectiveScore,
      fromTier: lead.callPriorityTier,
      toTier: priority.tier,
    })
  }

  logGrowthEngine("call_priority_recomputed", {
    leadId,
    computedScore: priority.computedScore,
    effectiveScore: priority.effectiveScore,
    tier: priority.tier,
    excludedFromQueue: priority.excludedFromQueue,
  })

  return fetchGrowthLeadById(admin, leadId)
}
