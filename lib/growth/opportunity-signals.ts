import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import { fetchGrowthLeadDecisionMakerById, listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import type { GrowthLeadOpportunityReadinessInput } from "@/lib/growth/opportunity-types"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import type { GrowthLead } from "@/lib/growth/types"

export async function fetchGrowthLeadOpportunityReadinessInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthLeadOpportunityReadinessInput> {
  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail)
  const latestRun = lead.latestResearchRunId
    ? await fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
    : null

  let primaryDecisionMakerPhone: string | null = null
  if (lead.primaryDecisionMakerId) {
    const primary = await fetchGrowthLeadDecisionMakerById(admin, lead.id, lead.primaryDecisionMakerId)
    primaryDecisionMakerPhone = primary?.phone ?? null
  } else {
    const decisionMakers = await listGrowthLeadDecisionMakers(admin, lead.id)
    primaryDecisionMakerPhone = decisionMakers.find((dm) => dm.isPrimary)?.phone ?? decisionMakers[0]?.phone ?? null
  }

  const usable = hasUsableResearch(lead.lastResearchedAt, lead.latestResearchRunId)

  return {
    status: lead.status,
    fit: lead.score,
    website: lead.website,
    contactPhone: lead.contactPhone,
    primaryDecisionMakerPhone,
    lastResearchedAt: lead.lastResearchedAt,
    latestResearchRunId: lead.latestResearchRunId,
    researchConfidence: latestRun?.researchConfidence ?? null,
    hasUsableResearch: usable,
    decisionMakerStatus: lead.decisionMakerStatus,
    engagementTier: lead.engagementTier,
    engagementScore: lead.engagementScore,
    engagementLastActivityAt: lead.engagementLastActivityAt,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipStrengthScore: lead.relationshipStrengthScore,
    relationshipTrend: lead.relationshipTrend,
    relationshipLastMeaningfulTouchAt: lead.relationshipLastMeaningfulTouchAt,
    lastHumanTouchAt: lead.lastHumanTouchAt,
    connectedCallCount: lead.connectedCallCount,
    callAttemptCount: lead.callAttemptCount,
    voicemailCount: lead.voicemailCount,
    isSuppressed: emailSummary.isSuppressed,
    hasPositiveReply: emailSummary.latestReplyClassification === "interested",
    hasNotInterestedReply: emailSummary.latestReplyClassification === "not_interested",
    createdAt: lead.createdAt,
    previousScore: lead.opportunityReadinessScore,
    previousTrend: lead.opportunityReadinessTrend,
  }
}

export function diffOpportunityBlockerKeys(
  previous: Array<{ key: string }>,
  current: Array<{ key: string }>,
): { added: string[]; resolved: string[] } {
  const prevKeys = new Set(previous.map((entry) => entry.key))
  const nextKeys = new Set(current.map((entry) => entry.key))
  return {
    added: [...nextKeys].filter((key) => !prevKeys.has(key)),
    resolved: [...prevKeys].filter((key) => !nextKeys.has(key)),
  }
}
