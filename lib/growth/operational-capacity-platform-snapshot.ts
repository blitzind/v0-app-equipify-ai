import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isExecutiveCloseCandidate } from "@/lib/growth/executive-operating-close-candidate"
import { matchesExecutiveOperatingQueueFilter } from "@/lib/growth/executive-operating-queue-filters"
import type { GrowthOperationalCapacityPlatformSnapshot } from "@/lib/growth/operational-capacity-types"
import type { GrowthLead } from "@/lib/growth/types"

const TERMINAL = new Set(["converted", "disqualified", "archived"])

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function daysSince(value: string | null, now: Date): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return (now.getTime() - parsed) / (24 * 60 * 60 * 1000)
}

export async function fetchGrowthOperationalCapacityPlatformSnapshot(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<GrowthOperationalCapacityPlatformSnapshot> {
  const { data, error } = await growthLeadsTable(admin)
    .select(
      "id, status, score, follow_up_at, call_priority_tier, last_human_touch_at, next_best_action, engagement_tier, engagement_last_activity_at, opportunity_readiness_tier, opportunity_age_bucket, opportunity_blockers, workflow_health, revenue_probability_tier, forecast_attention_level, executive_priority_tier, executive_intervention_opened_at, executive_intervention_age_bucket, relationship_owner_attention_level, intelligence_conflict_severity_score, decision_maker_status, opportunity_buying_signal_strength, relationship_strength_tier, operational_capacity_tier",
    )
    .not("status", "in", '("converted","disqualified","archived")')
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (data ?? []).filter((row) => !TERMINAL.has(row.status as string))
  let protectedPipelineCount = 0
  let protectedPipelineHealthyCount = 0

  const snapshot: GrowthOperationalCapacityPlatformSnapshot = {
    executiveNowCount: 0,
    executivePriorityCount: 0,
    openFollowUpCount: 0,
    callQueueLoadCount: 0,
    interventionBacklogCount: 0,
    interventionAgingCount: 0,
    interventionStalledCount: 0,
    priorityOpportunityCount: 0,
    leadershipBottleneckCount: 0,
    stalledOpportunityCount: 0,
    forecastAttentionCount: 0,
    hotOpportunityCount: 0,
    manualTouchBacklogCount: 0,
    decisionMakerBacklogCount: 0,
    protectedPipelineCount: 0,
    protectedPipelineHealthyCount: 0,
    assignedWorkOrders: 0,
    assignedTechnicians: 0,
    dispatchPressure: 0,
    supportQueuePressure: 0,
  }

  for (const row of rows) {
    const executiveTier = row.executive_priority_tier as GrowthLead["executivePriorityTier"]
    if (executiveTier === "executive_now") snapshot.executiveNowCount += 1
    if (executiveTier === "priority" || executiveTier === "executive_now") {
      snapshot.executivePriorityCount += 1
    }

    const followUpAt = row.follow_up_at as string | null
    if (followUpAt && Date.parse(followUpAt) > now.getTime()) snapshot.openFollowUpCount += 1

    const callTier = row.call_priority_tier as string | null
    if (callTier === "high" || callTier === "critical") snapshot.callQueueLoadCount += 1

    const interventionBucket = row.executive_intervention_age_bucket as string
    if (row.executive_intervention_opened_at) snapshot.interventionBacklogCount += 1
    if (interventionBucket === "aging") snapshot.interventionAgingCount += 1
    if (interventionBucket === "stalled") snapshot.interventionStalledCount += 1

    if (row.opportunity_readiness_tier === "priority_opportunity") {
      snapshot.priorityOpportunityCount += 1
    }
    if (row.opportunity_age_bucket === "stalled") snapshot.stalledOpportunityCount += 1

    const forecastAttention = row.forecast_attention_level as string
    const relationshipAttention = row.relationship_owner_attention_level as string
    if (
      forecastAttention === "important" ||
      forecastAttention === "critical" ||
      relationshipAttention === "important" ||
      relationshipAttention === "critical"
    ) {
      snapshot.forecastAttentionCount += 1
    }

    if (row.engagement_tier === "hot") {
      const activityDays = daysSince(row.engagement_last_activity_at as string | null, now)
      if (activityDays != null && activityDays <= 7) snapshot.hotOpportunityCount += 1
    }

    const touchDays = daysSince(row.last_human_touch_at as string | null, now)
    if (
      touchDays != null &&
      touchDays > 14 &&
      (executiveTier === "priority" ||
        executiveTier === "executive_now" ||
        row.opportunity_readiness_tier === "priority_opportunity" ||
        row.opportunity_readiness_tier === "sales_ready")
    ) {
      snapshot.manualTouchBacklogCount += 1
    }

    const blockers = Array.isArray(row.opportunity_blockers)
      ? (row.opportunity_blockers as Array<{ key: string }>)
      : []
    if (blockers.some((blocker) => blocker.key === "missing_decision_maker")) {
      snapshot.decisionMakerBacklogCount += 1
    }

    if (
      matchesExecutiveOperatingQueueFilter("leadership_bottlenecks", {
        status: row.status as GrowthLead["status"],
        executivePriorityScore: null,
        executivePriorityTier: executiveTier,
        intelligenceConflictSeverityScore: (row.intelligence_conflict_severity_score as number) ?? 0,
        intelligenceConflictCount: 0,
        executiveInterventionAgeBucket: interventionBucket,
        workflowHealth: row.workflow_health as GrowthLead["workflowHealth"],
        opportunityBlockerCount: blockers.length,
      })
    ) {
      snapshot.leadershipBottleneckCount += 1
    }

    const protectedLead =
      row.revenue_probability_tier === "commit_candidate" ||
      executiveTier === "executive_now" ||
      isExecutiveCloseCandidate({
        fit: row.score as number | null,
        opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
        relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
        opportunityBuyingSignalStrength: (row.opportunity_buying_signal_strength ??
          "none") as GrowthLead["opportunityBuyingSignalStrength"],
        revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
        decisionMakerStatus: row.decision_maker_status as GrowthLead["decisionMakerStatus"],
      })

    if (protectedLead) {
      protectedPipelineCount += 1
      const capacityTier = row.operational_capacity_tier as string | null
      if (capacityTier === "healthy" || capacityTier === "strained") {
        protectedPipelineHealthyCount += 1
      }
    }
  }

  snapshot.protectedPipelineCount = protectedPipelineCount
  snapshot.protectedPipelineHealthyCount = protectedPipelineHealthyCount
  return snapshot
}
