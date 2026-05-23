import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isExecutiveCloseCandidate } from "@/lib/growth/executive-operating-close-candidate"
import type { GrowthExecutiveOperatingTrendWindow } from "@/lib/growth/executive-operating-types"
import { isRevenueTierRegression } from "@/lib/growth/revenue-forecast-contribution"
import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"
import type { GrowthLead } from "@/lib/growth/types"

const TERMINAL = new Set(["converted", "disqualified", "archived"])

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function tierFromScore(score: number): import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier {
  if (score >= 85) return "commit_candidate"
  if (score >= 65) return "forecasted"
  if (score >= 45) return "probable"
  if (score >= 25) return "possible"
  return "unlikely"
}

function summarizeLead(row: Record<string, unknown>): Pick<
  GrowthLead,
  | "id"
  | "companyName"
  | "contactName"
  | "status"
  | "score"
  | "executivePriorityScore"
  | "executivePriorityTier"
  | "executivePrioritySummary"
  | "executivePriorityVolatility"
  | "executiveRecommendation"
  | "executiveOwner"
  | "executiveInterventionAgeBucket"
  | "intelligenceConflicts"
  | "intelligenceConflictSeverityScore"
  | "revenueProbabilityScore"
  | "revenueProbabilityTier"
  | "revenueTrajectory"
  | "forecastAttentionLevel"
  | "relationshipStrengthTier"
  | "relationshipTrend"
  | "relationshipOwnerAttentionLevel"
  | "opportunityReadinessTier"
  | "opportunityBlockers"
  | "engagementTier"
  | "nextBestAction"
> {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    status: row.status as GrowthLead["status"],
    score: row.score as number | null,
    executivePriorityScore: row.executive_priority_score as number | null,
    executivePriorityTier: row.executive_priority_tier as GrowthLead["executivePriorityTier"],
    executivePrioritySummary: row.executive_priority_summary as string | null,
    executivePriorityVolatility: (row.executive_priority_volatility as number | null) ?? 0,
    executiveRecommendation: row.executive_recommendation as string | null,
    executiveOwner: row.executive_owner as string | null,
    executiveInterventionAgeBucket: (row.executive_intervention_age_bucket ??
      "new") as GrowthLead["executiveInterventionAgeBucket"],
    intelligenceConflicts: Array.isArray(row.intelligence_conflicts)
      ? (row.intelligence_conflicts as GrowthLead["intelligenceConflicts"])
      : [],
    intelligenceConflictSeverityScore: (row.intelligence_conflict_severity_score as number | null) ?? 0,
    revenueProbabilityScore: row.revenue_probability_score as number | null,
    revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
    revenueTrajectory: (row.revenue_trajectory ?? "steady") as GrowthLead["revenueTrajectory"],
    forecastAttentionLevel: (row.forecast_attention_level ??
      "none") as GrowthLead["forecastAttentionLevel"],
    relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
    relationshipTrend: row.relationship_trend as GrowthLead["relationshipTrend"],
    relationshipOwnerAttentionLevel: (row.relationship_owner_attention_level ??
      "none") as GrowthLead["relationshipOwnerAttentionLevel"],
    opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
    opportunityBlockers: Array.isArray(row.opportunity_blockers)
      ? (row.opportunity_blockers as GrowthLead["opportunityBlockers"])
      : [],
    engagementTier: row.engagement_tier as GrowthLead["engagementTier"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, executive_priority_score, executive_priority_tier, executive_priority_summary, executive_priority_volatility, executive_priority_previous_score, executive_recommendation, executive_owner, executive_intervention_opened_at, executive_intervention_age_bucket, intelligence_conflicts, intelligence_conflict_severity_score, revenue_probability_score, revenue_probability_tier, revenue_probability_previous_score, revenue_trajectory, forecast_attention_level, relationship_strength_tier, relationship_trend, relationship_owner_attention_level, opportunity_readiness_tier, opportunity_buying_signal_strength, opportunity_blockers, engagement_tier, workflow_health, decision_maker_status, next_best_action, executive_operating_computed_at"

export async function fetchGrowthExecutiveOperatingDashboard(admin: SupabaseClient) {
  const now = Date.now()

  const { data: leads, error } = await growthLeadsTable(admin)
    .select(LEAD_SUMMARY_SELECT)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("executive_priority_score", { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.executive_priority_score as number | null) ?? 0)
  const averagePriority =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

  const executiveNow = rows
    .filter((row) => row.executive_priority_tier === "executive_now")
    .slice(0, 20)
    .map(summarizeLead)

  const revenueRisk = rows
    .filter((row) => {
      const trajectory = row.revenue_trajectory as string
      const previousScore = row.revenue_probability_previous_score as number | null
      const currentScore = (row.revenue_probability_score as number | null) ?? 0
      const currentTier = row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"]
      const previousTier =
        previousScore != null ? tierFromScore(previousScore) : null
      return (
        trajectory === "at_risk" ||
        trajectory === "slowing" ||
        isForecastRegression({
          previousScore,
          currentScore,
          previousTier,
          currentTier: currentTier ?? "unlikely",
          trajectory: trajectory as GrowthLead["revenueTrajectory"],
        })
      )
    })
    .slice(0, 20)
    .map(summarizeLead)

  const strategicRelationshipsCooling = rows
    .filter(
      (row) =>
        row.relationship_strength_tier === "strategic" && row.relationship_trend === "cooling",
    )
    .slice(0, 20)
    .map(summarizeLead)

  const executiveCloseCandidates = rows
    .filter((row) =>
      isExecutiveCloseCandidate({
        fit: row.score as number | null,
        opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
        relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
        opportunityBuyingSignalStrength: (row.opportunity_buying_signal_strength ??
          "none") as GrowthLead["opportunityBuyingSignalStrength"],
        revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
        decisionMakerStatus: row.decision_maker_status as GrowthLead["decisionMakerStatus"],
      }),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const forecastRegressionWatch = rows
    .filter((row) => {
      const trajectory = row.revenue_trajectory as string
      const previousScore = row.revenue_probability_previous_score as number | null
      const currentScore = (row.revenue_probability_score as number | null) ?? 0
      const currentTier = row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"]
      const previousTier =
        previousScore != null ? tierFromScore(previousScore) : null
      const scoreDelta = previousScore != null ? currentScore - previousScore : 0
      return (
        trajectory === "at_risk" ||
        trajectory === "slowing" ||
        (previousTier != null &&
          currentTier != null &&
          isRevenueTierRegression(previousTier, currentTier)) ||
        scoreDelta <= -10
      )
    })
    .slice(0, 20)
    .map(summarizeLead)

  const criticalBlockers = rows
    .filter((row) => {
      const blockers = Array.isArray(row.opportunity_blockers)
        ? (row.opportunity_blockers as Array<{ key: string }>)
        : []
      return blockers.some(
        (blocker) => blocker.key === "suppressed" || blocker.key === "not_interested",
      ) || blockers.length >= 3
    })
    .slice(0, 20)
    .map(summarizeLead)

  const highAttentionAccounts = rows
    .filter(
      (row) =>
        row.forecast_attention_level === "important" ||
        row.forecast_attention_level === "critical" ||
        row.relationship_owner_attention_level === "important" ||
        row.relationship_owner_attention_level === "critical",
    )
    .slice(0, 20)
    .map(summarizeLead)

  const leadershipBottlenecks = rows
    .filter((row) => {
      const blockers = Array.isArray(row.opportunity_blockers)
        ? (row.opportunity_blockers as unknown[])
        : []
      const workflow = row.workflow_health as string | null
      const severity = (row.intelligence_conflict_severity_score as number | null) ?? 0
      const ageBucket = row.executive_intervention_age_bucket as string
      return (
        severity >= 40 ||
        blockers.length >= 3 ||
        workflow === "stalled" ||
        workflow === "blocked" ||
        ageBucket === "aging" ||
        ageBucket === "stalled"
      )
    })
    .sort(
      (a, b) =>
        ((b.intelligence_conflict_severity_score as number | null) ?? 0) -
          ((a.intelligence_conflict_severity_score as number | null) ?? 0) ||
        ((b.executive_priority_score as number | null) ?? 0) -
          ((a.executive_priority_score as number | null) ?? 0),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const trend = buildExecutiveOperatingTrend(rows, now)

  return {
    averagePriority,
    executiveNow,
    revenueRisk,
    strategicRelationshipsCooling,
    executiveCloseCandidates,
    forecastRegressionWatch,
    criticalBlockers,
    highAttentionAccounts,
    leadershipBottlenecks,
    trend,
    tierCounts: {
      monitor: rows.filter((row) => row.executive_priority_tier === "monitor").length,
      important: rows.filter((row) => row.executive_priority_tier === "important").length,
      priority: rows.filter((row) => row.executive_priority_tier === "priority").length,
      executive_now: rows.filter((row) => row.executive_priority_tier === "executive_now").length,
    },
  }
}

function buildExecutiveOperatingTrend(
  rows: Array<{ executive_priority_score: number | null; executive_operating_computed_at: string | null }>,
  nowMs: number,
) {
  const windows: Record<GrowthExecutiveOperatingTrendWindow, { bucketDays: number; bucketCount: number }> = {
    "7d": { bucketDays: 1, bucketCount: 7 },
    "30d": { bucketDays: 1, bucketCount: 30 },
    "90d": { bucketDays: 7, bucketCount: 13 },
  }

  const result: Record<
    GrowthExecutiveOperatingTrendWindow,
    Array<{ label: string; averagePriority: number }>
  > = {
    "7d": [],
    "30d": [],
    "90d": [],
  }

  for (const [window, config] of Object.entries(windows) as [
    GrowthExecutiveOperatingTrendWindow,
    { bucketDays: number; bucketCount: number },
  ][]) {
    for (let i = config.bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = nowMs - i * config.bucketDays * 24 * 60 * 60 * 1000
      const bucketStart = bucketEnd - config.bucketDays * 24 * 60 * 60 * 1000
      const bucketRows = rows.filter((row) => {
        if (!row.executive_operating_computed_at) return false
        const ts = Date.parse(row.executive_operating_computed_at)
        return ts >= bucketStart && ts < bucketEnd
      })
      const averagePriority =
        bucketRows.length > 0
          ? Math.round(
              bucketRows.reduce(
                (sum, row) => sum + ((row.executive_priority_score as number | null) ?? 0),
                0,
              ) / bucketRows.length,
            )
          : 0
      result[window].push({
        label: new Date(bucketStart).toISOString().slice(0, 10),
        averagePriority,
      })
    }
  }

  return result
}
