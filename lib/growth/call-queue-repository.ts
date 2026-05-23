import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeGrowthCallPriority, matchesCallQueueFilter } from "@/lib/growth/call-priority"
import type { GrowthCallQueueFilter, GrowthCallQueueRow } from "@/lib/growth/call-types"
import { fetchGrowthLeadDecisionMakerById } from "@/lib/growth/decision-maker-repository"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import {
  fetchGrowthLeadResearchNotes,
  fetchLatestUsableGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import type { GrowthLead } from "@/lib/growth/types"

export async function listGrowthCallQueue(
  admin: SupabaseClient,
  input: {
    filter: GrowthCallQueueFilter
    limit?: number
    offset?: number
  },
): Promise<GrowthCallQueueRow[]> {
  const leads = await listGrowthLeads(admin, { limit: 200, offset: 0 })
  const now = new Date()
  const enriched: GrowthCallQueueRow[] = []

  for (const lead of leads) {
    const latestRun = lead.latestResearchRunId
      ? await fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
      : null
    const manualNotes = await fetchGrowthLeadResearchNotes(admin, lead.id)
    const websiteFetchStatus = latestRun?.websiteFetchStatus ?? null

    if (
      !matchesCallQueueFilter(input.filter, {
        status: lead.status,
        score: lead.score,
        lastResearchedAt: lead.lastResearchedAt,
        latestResearchRunId: lead.latestResearchRunId,
        callDisposition: lead.callDisposition,
        followUpAt: lead.followUpAt,
        website: lead.website,
        websiteFetchStatus,
      }, now)
    ) {
      continue
    }

    const priority = computeGrowthCallPriority({
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
      now,
    })

    enriched.push(
      await buildQueueRow(
        admin,
        lead,
        priority.effectiveScore,
        priority.tier,
        priority.whySummary,
        latestRun?.result?.recommendedNextAction ?? null,
        websiteFetchStatus,
      ),
    )
  }

  enriched.sort((a, b) => (b.callPriorityScore ?? 0) - (a.callPriorityScore ?? 0))

  const offset = Math.max(input.offset ?? 0, 0)
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  return enriched.slice(offset, offset + limit).map((row, index) => ({
    ...row,
    rank: offset + index + 1,
  }))
}

async function buildQueueRow(
  admin: SupabaseClient,
  lead: GrowthLead,
  effectiveScore: number,
  tier: GrowthCallQueueRow["callPriorityTier"],
  whySummary: string,
  recommendedNextAction: string | null,
  websiteFetchStatus: string | null,
): Promise<GrowthCallQueueRow> {
  let primaryDecisionMakerName: string | null = null
  if (lead.primaryDecisionMakerId) {
    const primary = await fetchGrowthLeadDecisionMakerById(admin, lead.id, lead.primaryDecisionMakerId)
    primaryDecisionMakerName = primary?.fullName ?? null
  }

  return {
    leadId: lead.id,
    rank: 0,
    companyName: lead.companyName,
    contactName: lead.contactName,
    contactPhone: lead.contactPhone,
    city: lead.city,
    state: lead.state,
    status: lead.status,
    researchPriority: lead.researchPriority,
    score: lead.score,
    callPriorityScore: lead.callPriorityScore ?? effectiveScore,
    callPriorityTier: tier,
    callPriorityOverride: lead.callPriorityOverride,
    callDisposition: lead.callDisposition,
    followUpAt: lead.followUpAt,
    lastResearchedAt: lead.lastResearchedAt,
    lastCallAt: lead.lastCallAt,
    lastHumanTouchAt: lead.lastHumanTouchAt,
    recommendedNextAction,
    websiteFetchStatus,
    whySummary,
    nextBestAction: lead.nextBestAction,
    nextBestActionReason: lead.nextBestActionReason,
    decisionMakerStatus: lead.decisionMakerStatus,
    primaryDecisionMakerName,
    momentumScore: lead.momentumScore,
    momentumTier: lead.momentumTier,
    workflowHealth: lead.workflowHealth,
    sourceChannel: lead.sourceChannel,
    sourceCampaign: lead.sourceCampaign,
    sourceKind: lead.sourceKind,
    agingDays: lead.agingDays,
    agingBucket: lead.agingBucket,
  }
}
