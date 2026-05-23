import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { computeGrowthLeadOperationalCapacity } from "@/lib/growth/operational-capacity-score"
import { fetchGrowthLeadOperationalCapacityInput } from "@/lib/growth/operational-capacity-signals"
import { diffOperationalConstraintKeys } from "@/lib/growth/operational-capacity-types"
import {
  emitGrowthLeadCapacityConstraintAddedTimeline,
  emitGrowthLeadCapacityConstraintResolvedTimeline,
  emitGrowthLeadOperationalCapacityChangedTimeline,
  emitGrowthLeadOperationalRiskDetectedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadOperationalCapacity(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadOperationalCapacityInput(admin, lead)
  const result = computeGrowthLeadOperationalCapacity(input)
  const now = new Date().toISOString()

  const constraintDiff = diffOperationalConstraintKeys(
    lead.operationalConstraints,
    result.constraints,
  )

  const { error } = await growthLeadsTable(admin)
    .update({
      operational_capacity_score: result.score,
      operational_capacity_tier: result.tier,
      operational_capacity_summary: result.summary,
      operational_capacity_top_constraints: result.topConstraints,
      capacity_pressure_level: result.pressureLevel,
      capacity_pressure_volatility: result.pressureVolatility,
      protected_pipeline_coverage: result.protectedPipelineCoverage,
      operational_constraints: result.constraints,
      capacity_conflicts: result.conflicts,
      capacity_protection_recommendation: result.protectionRecommendation,
      constraint_opened_at: result.constraintOpenedAt,
      constraint_age_bucket: result.constraintAgeBucket,
      capacity_recovery_direction: result.recoveryDirection,
      operational_capacity_previous_score: lead.operationalCapacityScore,
      operational_capacity_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("operational_capacity_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.operationalCapacityScore
  const prevTier = lead.operationalCapacityTier

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadOperationalCapacityChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
  } else if (prevTier !== result.tier) {
    await emitGrowthLeadOperationalCapacityChangedTimeline(admin, {
      leadId,
      from: prevScore ?? 0,
      to: result.score,
      summary: `${prevTier ?? "none"} → ${result.tier}: ${result.summary}`,
    })
  }

  for (const key of constraintDiff.added) {
    const constraint = result.constraints.find((entry) => entry.key === key)
    if (!constraint) continue
    await emitGrowthLeadCapacityConstraintAddedTimeline(admin, {
      leadId,
      key,
      label: constraint.label,
    })
  }

  for (const key of constraintDiff.resolved) {
    const constraint = lead.operationalConstraints.find((entry) => entry.key === key)
    await emitGrowthLeadCapacityConstraintResolvedTimeline(admin, {
      leadId,
      key,
      label: constraint?.label ?? key,
    })
  }

  const hadRisk =
    lead.operationalCapacityTier === "critical" ||
    lead.capacityConflicts.some((entry) => entry.severity === "critical")
  const hasRisk =
    result.tier === "critical" ||
    result.conflicts.some((entry) => entry.severity === "critical")

  if (hasRisk && !hadRisk) {
    await emitGrowthLeadOperationalRiskDetectedTimeline(admin, {
      leadId,
      tier: result.tier,
      summary: result.summary,
    })
  }

  logGrowthEngine("operational_capacity_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    pressureLevel: result.pressureLevel,
    pressureVolatility: result.pressureVolatility,
    protectedPipelineCoverage: result.protectedPipelineCoverage,
    recoveryDirection: result.recoveryDirection,
    constraintCount: result.constraints.length,
  })

  return fetchGrowthLeadById(admin, leadId)
}
