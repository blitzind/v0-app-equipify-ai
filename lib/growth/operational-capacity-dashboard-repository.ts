import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isExecutiveCloseCandidate } from "@/lib/growth/executive-operating-close-candidate"
import {
  detectOperationalConstraints,
  computePlatformPressureLevel,
} from "@/lib/growth/operational-capacity-constraints"
import { fetchGrowthOperationalCapacityPlatformSnapshot } from "@/lib/growth/operational-capacity-platform-snapshot"
import type { GrowthOperationalCapacityTrendWindow } from "@/lib/growth/operational-capacity-types"
import type { GrowthLead } from "@/lib/growth/types"

const TERMINAL = new Set(["converted", "disqualified", "archived"])

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function summarizeLead(row: Record<string, unknown>): Pick<
  GrowthLead,
  | "id"
  | "companyName"
  | "contactName"
  | "status"
  | "score"
  | "operationalCapacityScore"
  | "operationalCapacityTier"
  | "operationalCapacitySummary"
  | "capacityPressureLevel"
  | "capacityPressureVolatility"
  | "protectedPipelineCoverage"
  | "operationalConstraints"
  | "capacityConflicts"
  | "capacityProtectionRecommendation"
  | "constraintAgeBucket"
  | "capacityRecoveryDirection"
  | "executivePriorityTier"
  | "revenueProbabilityTier"
  | "nextBestAction"
> {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    status: row.status as GrowthLead["status"],
    score: row.score as number | null,
    operationalCapacityScore: row.operational_capacity_score as number | null,
    operationalCapacityTier: row.operational_capacity_tier as GrowthLead["operationalCapacityTier"],
    operationalCapacitySummary: row.operational_capacity_summary as string | null,
    capacityPressureLevel: (row.capacity_pressure_level as number | null) ?? 0,
    capacityPressureVolatility: (row.capacity_pressure_volatility as number | null) ?? 0,
    protectedPipelineCoverage: (row.protected_pipeline_coverage as number | null) ?? 0,
    operationalConstraints: Array.isArray(row.operational_constraints)
      ? (row.operational_constraints as GrowthLead["operationalConstraints"])
      : [],
    capacityConflicts: Array.isArray(row.capacity_conflicts)
      ? (row.capacity_conflicts as GrowthLead["capacityConflicts"])
      : [],
    capacityProtectionRecommendation: row.capacity_protection_recommendation as string | null,
    constraintAgeBucket: (row.constraint_age_bucket ?? "new") as GrowthLead["constraintAgeBucket"],
    capacityRecoveryDirection: (row.capacity_recovery_direction ??
      "stable") as GrowthLead["capacityRecoveryDirection"],
    executivePriorityTier: row.executive_priority_tier as GrowthLead["executivePriorityTier"],
    revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

function isProtectedRow(row: Record<string, unknown>): boolean {
  return (
    row.revenue_probability_tier === "commit_candidate" ||
    row.executive_priority_tier === "executive_now" ||
    isExecutiveCloseCandidate({
      fit: row.score as number | null,
      opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
      relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
      opportunityBuyingSignalStrength: (row.opportunity_buying_signal_strength ??
        "none") as GrowthLead["opportunityBuyingSignalStrength"],
      revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
      decisionMakerStatus: row.decision_maker_status as GrowthLead["decisionMakerStatus"],
    })
  )
}

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, operational_capacity_score, operational_capacity_tier, operational_capacity_summary, capacity_pressure_level, capacity_pressure_volatility, protected_pipeline_coverage, operational_constraints, capacity_conflicts, capacity_protection_recommendation, constraint_opened_at, constraint_age_bucket, capacity_recovery_direction, executive_priority_tier, executive_priority_score, executive_intervention_age_bucket, revenue_probability_tier, revenue_probability_score, opportunity_readiness_tier, relationship_strength_tier, opportunity_buying_signal_strength, decision_maker_status, next_best_action, operational_capacity_computed_at"

export async function fetchGrowthOperationalCapacityDashboard(admin: SupabaseClient) {
  const now = Date.now()
  const snapshot = await fetchGrowthOperationalCapacityPlatformSnapshot(admin)
  const platformConstraints = detectOperationalConstraints(snapshot)
  const platformPressure = computePlatformPressureLevel(snapshot, platformConstraints)

  const { data: leads, error } = await growthLeadsTable(admin)
    .select(LEAD_SUMMARY_SELECT)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("operational_capacity_score", { ascending: true, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.operational_capacity_score as number | null) ?? 0)
  const averageCapacityScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

  const protectedPipelineCoverage =
    snapshot.protectedPipelineCount <= 0
      ? 100
      : Math.round((snapshot.protectedPipelineHealthyCount / snapshot.protectedPipelineCount) * 100)

  const constraintDistribution: Record<string, number> = {}
  for (const constraint of platformConstraints) {
    constraintDistribution[constraint.key] = (constraintDistribution[constraint.key] ?? 0) + 1
  }
  for (const row of rows) {
    const constraints = Array.isArray(row.operational_constraints)
      ? (row.operational_constraints as Array<{ key: string }>)
      : []
    for (const constraint of constraints) {
      constraintDistribution[constraint.key] = (constraintDistribution[constraint.key] ?? 0) + 1
    }
  }

  const leadershipLoad = rows
    .filter(
      (row) =>
        row.executive_priority_tier === "executive_now" ||
        row.executive_priority_tier === "priority",
    )
    .slice(0, 20)
    .map(summarizeLead)

  const interventionLoad = rows
    .filter((row) => {
      const bucket = row.executive_intervention_age_bucket as string
      return bucket === "aging" || bucket === "stalled"
    })
    .slice(0, 20)
    .map(summarizeLead)

  const operationalRisk = rows
    .filter((row) => {
      const tier = row.operational_capacity_tier as string
      const conflicts = Array.isArray(row.capacity_conflicts)
        ? (row.capacity_conflicts as Array<{ severity: string }>)
        : []
      return tier === "critical" || conflicts.some((entry) => entry.severity === "critical")
    })
    .slice(0, 20)
    .map(summarizeLead)

  const executionProtection = rows
    .filter((row) => {
      if (!isProtectedRow(row)) return false
      const tier = row.operational_capacity_tier as string
      const conflicts = Array.isArray(row.capacity_conflicts)
        ? (row.capacity_conflicts as unknown[])
        : []
      return tier === "constrained" || tier === "critical" || conflicts.length > 0
    })
    .sort(
      (a, b) =>
        ((a.operational_capacity_score as number | null) ?? 100) -
        ((b.operational_capacity_score as number | null) ?? 100),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const capacityAtRisk = rows
    .filter(
      (row) =>
        row.operational_capacity_tier === "constrained" ||
        row.operational_capacity_tier === "critical",
    )
    .slice(0, 20)
    .map(summarizeLead)

  const trend = buildOperationalCapacityTrend(rows, now)

  return {
    averageCapacityScore,
    averagePressureLevel: platformPressure,
    protectedPipelineCoverage,
    platformSnapshot: {
      executiveNowCount: snapshot.executiveNowCount,
      callQueueLoadCount: snapshot.callQueueLoadCount,
      openFollowUpCount: snapshot.openFollowUpCount,
      interventionBacklogCount: snapshot.interventionBacklogCount,
      interventionAgingCount: snapshot.interventionAgingCount,
      interventionStalledCount: snapshot.interventionStalledCount,
      leadershipBottleneckCount: snapshot.leadershipBottleneckCount,
      decisionMakerBacklogCount: snapshot.decisionMakerBacklogCount,
      manualTouchBacklogCount: snapshot.manualTouchBacklogCount,
    },
    tierCounts: {
      healthy: rows.filter((row) => row.operational_capacity_tier === "healthy").length,
      strained: rows.filter((row) => row.operational_capacity_tier === "strained").length,
      constrained: rows.filter((row) => row.operational_capacity_tier === "constrained").length,
      critical: rows.filter((row) => row.operational_capacity_tier === "critical").length,
    },
    recoveryDirectionCounts: {
      recovering: rows.filter((row) => row.capacity_recovery_direction === "recovering").length,
      stable: rows.filter((row) => row.capacity_recovery_direction === "stable").length,
      worsening: rows.filter((row) => row.capacity_recovery_direction === "worsening").length,
    },
    constraintDistribution,
    leadershipLoad,
    interventionLoad,
    operationalRisk,
    executionProtection,
    capacityAtRisk,
    trend,
  }
}

function buildOperationalCapacityTrend(
  rows: Array<{ capacity_pressure_level: number | null; operational_capacity_computed_at: string | null }>,
  nowMs: number,
) {
  const windows: Record<GrowthOperationalCapacityTrendWindow, { bucketDays: number; bucketCount: number }> = {
    "7d": { bucketDays: 1, bucketCount: 7 },
    "30d": { bucketDays: 1, bucketCount: 30 },
    "90d": { bucketDays: 7, bucketCount: 13 },
  }

  const result: Record<
    GrowthOperationalCapacityTrendWindow,
    Array<{ label: string; averagePressure: number }>
  > = {
    "7d": [],
    "30d": [],
    "90d": [],
  }

  for (const [window, config] of Object.entries(windows) as [
    GrowthOperationalCapacityTrendWindow,
    { bucketDays: number; bucketCount: number },
  ][]) {
    for (let i = config.bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = nowMs - i * config.bucketDays * 24 * 60 * 60 * 1000
      const bucketStart = bucketEnd - config.bucketDays * 24 * 60 * 60 * 1000
      const bucketRows = rows.filter((row) => {
        if (!row.operational_capacity_computed_at) return false
        const ts = Date.parse(row.operational_capacity_computed_at)
        return ts >= bucketStart && ts < bucketEnd
      })
      const averagePressure =
        bucketRows.length > 0
          ? Math.round(
              bucketRows.reduce(
                (sum, row) => sum + ((row.capacity_pressure_level as number | null) ?? 0),
                0,
              ) / bucketRows.length,
            )
          : 0
      result[window].push({
        label: new Date(bucketStart).toISOString().slice(0, 10),
        averagePressure,
      })
    }
  }

  return result
}
