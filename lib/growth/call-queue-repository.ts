import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { matchesCallQueueFilter } from "@/lib/growth/call-priority"
import type { GrowthCallQueueFilter, GrowthCallQueueRow } from "@/lib/growth/call-types"
import { loadEmailDiscoveryLeadRollup } from "@/lib/growth/email-discovery/email-discovery-lead-rollup"
import {
  matchesEmailDiscoveryProspectFilter,
  type GrowthEmailDiscoveryProspectFilter,
} from "@/lib/growth/email-discovery/email-discovery-runtime-types"
import { fetchGrowthLeadDecisionMakerById } from "@/lib/growth/decision-maker-repository"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import { resolveGrowthRepLabels } from "@/lib/growth/assignment/rep-roster-repository"
import { computeGrowthLeadCallPriorityResult } from "@/lib/growth/recompute-lead-call-priority"
import {
  fetchLatestUsableGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import { isProtectedGrowthOpportunityFromLead } from "@/lib/growth/operational-capacity-score"
import { sortCallQueueByRevenueWorkflow } from "@/lib/growth/revenue-workflow/call-queue-prioritization"
import type { GrowthLead } from "@/lib/growth/types"

const CAPACITY_FILTERS = new Set<GrowthCallQueueFilter>([
  "capacity_risk",
  "executive_overload",
  "protected_opportunities",
  "constraint_pressure",
])

export async function listGrowthCallQueue(
  admin: SupabaseClient,
  input: {
    filter: GrowthCallQueueFilter
    limit?: number
    offset?: number
    assignedTo?: string | null
    unassigned?: boolean
    emailDiscoveryFilter?: GrowthEmailDiscoveryProspectFilter | null
  },
): Promise<GrowthCallQueueRow[]> {
  const leads = await listGrowthLeads(admin, {
    limit: 200,
    offset: 0,
    assignedTo: input.assignedTo ?? undefined,
    unassigned: input.unassigned,
  })
  const ownerLabels = await resolveGrowthRepLabels(
    admin,
    leads.map((lead) => lead.assignedTo).filter(Boolean) as string[],
  )
  const now = new Date()
  const enriched: GrowthCallQueueRow[] = []

  for (const lead of leads) {
    const latestRun = lead.latestResearchRunId
      ? await fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
      : null
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
        engagementScore: lead.engagementScore,
        engagementTier: lead.engagementTier,
        engagementLastActivityAt: lead.engagementLastActivityAt,
        decisionMakerStatus: lead.decisionMakerStatus,
        relationshipStrengthScore: lead.relationshipStrengthScore,
        relationshipStrengthTier: lead.relationshipStrengthTier,
        relationshipTrend: lead.relationshipTrend,
        opportunityReadinessScore: lead.opportunityReadinessScore,
        opportunityReadinessTier: lead.opportunityReadinessTier,
        opportunityBlockers: lead.opportunityBlockers,
        revenueProbabilityScore: lead.revenueProbabilityScore,
        revenueProbabilityTier: lead.revenueProbabilityTier,
        revenueProbabilityConfidence: lead.revenueProbabilityConfidence,
        executivePriorityScore: lead.executivePriorityScore,
        executivePriorityTier: lead.executivePriorityTier,
        intelligenceConflictSeverityScore: lead.intelligenceConflictSeverityScore,
        intelligenceConflictCount: lead.intelligenceConflicts.length,
        executiveInterventionAgeBucket: lead.executiveInterventionAgeBucket,
        workflowHealth: lead.workflowHealth,
        opportunityBlockerCount: lead.opportunityBlockers.length,
        operationalCapacityScore: lead.operationalCapacityScore,
        operationalCapacityTier: lead.operationalCapacityTier,
        capacityPressureLevel: lead.capacityPressureLevel,
        operationalConstraintKeys: lead.operationalConstraints.map((entry) => entry.key),
        operationalConstraintCount: lead.operationalConstraints.length,
        isProtectedOpportunity: isProtectedGrowthOpportunityFromLead(lead),
        capacityConflictCount: lead.capacityConflicts.length,
      }, now)
    ) {
      continue
    }

    if (input.emailDiscoveryFilter) {
      const rollup = await loadEmailDiscoveryLeadRollup(admin, lead.id)
      if (!matchesEmailDiscoveryProspectFilter(input.emailDiscoveryFilter, rollup)) {
        continue
      }
    }

    const hasPersistedPriority =
      lead.callPriorityScore != null &&
      lead.callPriorityTier != null &&
      Boolean(lead.callPriorityComputedAt)

    const priority = hasPersistedPriority
      ? {
          effectiveScore: lead.callPriorityScore!,
          tier: lead.callPriorityTier!,
          whySummary: "Persisted Sprint 4 call priority.",
          computedScore: lead.callPriorityScore!,
          excludedFromQueue: false,
        }
      : await computeGrowthLeadCallPriorityResult(admin, lead)

    enriched.push(
      await buildQueueRow(
        admin,
        lead,
        priority.effectiveScore,
        priority.tier,
        priority.whySummary,
        latestRun?.result?.recommendedNextAction ?? null,
        websiteFetchStatus,
        lead.assignedTo ? ownerLabels.get(lead.assignedTo) ?? null : null,
      ),
    )
  }

  if (CAPACITY_FILTERS.has(input.filter)) {
    enriched.sort((a, b) => {
      const capacityDiff = (a.operationalCapacityScore ?? 100) - (b.operationalCapacityScore ?? 100)
      if (capacityDiff !== 0) return capacityDiff
      const pressureDiff = (b.capacityPressureLevel ?? 0) - (a.capacityPressureLevel ?? 0)
      if (pressureDiff !== 0) return pressureDiff
      return (b.callPriorityScore ?? 0) - (a.callPriorityScore ?? 0)
    })
  } else {
    const sorted = sortCallQueueByRevenueWorkflow(
      enriched.map((row) => ({
        ...row,
        effectiveScore: row.callPriorityScore ?? 0,
      })),
    )
    enriched.splice(0, enriched.length, ...sorted)
  }

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
  assignedToLabel: string | null,
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
    callPriorityScore: effectiveScore,
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
    engagementScore: lead.engagementScore,
    engagementTier: lead.engagementTier,
    engagementLastActivityAt: lead.engagementLastActivityAt,
    engagementSummary: lead.engagementSummary,
    relationshipStrengthScore: lead.relationshipStrengthScore,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipTrend: lead.relationshipTrend,
    relationshipSummary: lead.relationshipSummary,
    relationshipOwnerAttentionLevel: lead.relationshipOwnerAttentionLevel,
    opportunityReadinessScore: lead.opportunityReadinessScore,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    opportunityReadinessTrend: lead.opportunityReadinessTrend,
    opportunityReadinessSummary: lead.opportunityReadinessSummary,
    opportunityReadinessConfidence: lead.opportunityReadinessConfidence,
    opportunityBuyingSignalStrength: lead.opportunityBuyingSignalStrength,
    revenueProbabilityScore: lead.revenueProbabilityScore,
    revenueProbabilityTier: lead.revenueProbabilityTier,
    revenueProbabilityConfidence: lead.revenueProbabilityConfidence,
    revenueTrajectory: lead.revenueTrajectory,
    revenueProbabilityVolatility: lead.revenueProbabilityVolatility,
    forecastAttentionLevel: lead.forecastAttentionLevel,
    executivePriorityScore: lead.executivePriorityScore,
    executivePriorityTier: lead.executivePriorityTier,
    intelligenceConflictSeverityScore: lead.intelligenceConflictSeverityScore,
    intelligenceConflictCount: lead.intelligenceConflicts.length,
    executiveInterventionAgeBucket: lead.executiveInterventionAgeBucket,
    operationalCapacityScore: lead.operationalCapacityScore,
    capacityPressureLevel: lead.capacityPressureLevel,
    assignedTo: lead.assignedTo,
    assignedToLabel,
    assignmentSource: lead.assignmentSource,
  }
}
