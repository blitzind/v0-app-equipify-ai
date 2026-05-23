import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isRevenueTierRegression } from "@/lib/growth/revenue-forecast-contribution"
import type {
  GrowthRevenueForecastTrendWindow,
  GrowthRevenueProbabilityTier,
} from "@/lib/growth/revenue-forecast-types"
import type { GrowthLead } from "@/lib/growth/types"

const TERMINAL = new Set(["converted", "disqualified", "archived"])

function tierFromScore(score: number): GrowthRevenueProbabilityTier {
  if (score >= 85) return "commit_candidate"
  if (score >= 65) return "forecasted"
  if (score >= 45) return "probable"
  if (score >= 25) return "possible"
  return "unlikely"
}

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
  | "revenueProbabilityScore"
  | "revenueProbabilityTier"
  | "revenueProbabilitySummary"
  | "revenueProbabilityConfidence"
  | "revenueTrajectory"
  | "revenueProbabilityVolatility"
  | "forecastAttentionLevel"
  | "forecastContributionWeight"
  | "revenueProbabilityPreviousScore"
  | "opportunityReadinessTier"
  | "relationshipStrengthTier"
  | "engagementTier"
  | "nextBestAction"
> {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    status: row.status as GrowthLead["status"],
    score: row.score as number | null,
    revenueProbabilityScore: row.revenue_probability_score as number | null,
    revenueProbabilityTier: row.revenue_probability_tier as GrowthLead["revenueProbabilityTier"],
    revenueProbabilitySummary: row.revenue_probability_summary as string | null,
    revenueProbabilityConfidence: (row.revenue_probability_confidence as number | null) ?? 0,
    revenueTrajectory: (row.revenue_trajectory ?? "steady") as GrowthLead["revenueTrajectory"],
    revenueProbabilityVolatility: (row.revenue_probability_volatility as number | null) ?? 0,
    forecastAttentionLevel: (row.forecast_attention_level ??
      "none") as GrowthLead["forecastAttentionLevel"],
    forecastContributionWeight: (row.forecast_contribution_weight as number | null) ?? 0,
    revenueProbabilityPreviousScore: row.revenue_probability_previous_score as number | null,
    opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
    relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
    engagementTier: row.engagement_tier as GrowthLead["engagementTier"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, revenue_probability_score, revenue_probability_tier, revenue_probability_summary, revenue_probability_confidence, revenue_probability_previous_score, revenue_trajectory, revenue_probability_volatility, forecast_contribution_weight, forecast_attention_level, revenue_forecast_computed_at, opportunity_readiness_tier, relationship_strength_tier, engagement_tier, next_best_action"

export async function fetchGrowthRevenueForecastDashboard(admin: SupabaseClient) {
  const now = Date.now()

  const { data: leads, error } = await growthLeadsTable(admin)
    .select(LEAD_SUMMARY_SELECT)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("revenue_probability_score", { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.revenue_probability_score as number | null) ?? 0)
  const averageProbability =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

  const commitCandidates = rows
    .filter((row) => row.revenue_probability_tier === "commit_candidate")
    .slice(0, 20)
    .map(summarizeLead)

  const forecasted = rows
    .filter((row) => row.revenue_probability_tier === "forecasted")
    .slice(0, 20)
    .map(summarizeLead)

  const revenueRegressionWatch = rows
    .filter((row) => {
      const trajectory = row.revenue_trajectory as string
      const previousScore = row.revenue_probability_previous_score as number | null
      const currentScore = (row.revenue_probability_score as number | null) ?? 0
      const currentTier = row.revenue_probability_tier as GrowthRevenueProbabilityTier | null
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
    .sort(
      (a, b) =>
        ((b.revenue_probability_volatility as number | null) ?? 0) -
          ((a.revenue_probability_volatility as number | null) ?? 0) ||
        ((a.revenue_probability_score as number | null) ?? 0) -
          ((b.revenue_probability_score as number | null) ?? 0),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const highAttention = rows
    .filter(
      (row) =>
        row.forecast_attention_level === "important" || row.forecast_attention_level === "critical",
    )
    .slice(0, 20)
    .map(summarizeLead)

  const fastestImproving = rows
    .filter(
      (row) =>
        row.revenue_probability_previous_score != null &&
        row.revenue_probability_score != null &&
        (row.revenue_probability_score as number) - (row.revenue_probability_previous_score as number) >= 8,
    )
    .sort(
      (a, b) =>
        ((b.revenue_probability_score as number) - (b.revenue_probability_previous_score as number)) -
        ((a.revenue_probability_score as number) - (a.revenue_probability_previous_score as number)),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const trend = buildRevenueForecastTrend(rows, now)

  return {
    averageProbability,
    commitCandidates,
    forecasted,
    revenueRegressionWatch,
    highAttention,
    fastestImproving,
    trend,
    tierCounts: {
      unlikely: rows.filter((row) => row.revenue_probability_tier === "unlikely").length,
      possible: rows.filter((row) => row.revenue_probability_tier === "possible").length,
      probable: rows.filter((row) => row.revenue_probability_tier === "probable").length,
      forecasted: rows.filter((row) => row.revenue_probability_tier === "forecasted").length,
      commit_candidate: rows.filter((row) => row.revenue_probability_tier === "commit_candidate").length,
    },
    trajectoryCounts: {
      accelerating: rows.filter((row) => row.revenue_trajectory === "accelerating").length,
      steady: rows.filter((row) => row.revenue_trajectory === "steady").length,
      slowing: rows.filter((row) => row.revenue_trajectory === "slowing").length,
      at_risk: rows.filter((row) => row.revenue_trajectory === "at_risk").length,
    },
  }
}

function buildRevenueForecastTrend(
  rows: Array<{ revenue_probability_score: number | null; revenue_forecast_computed_at: string | null }>,
  nowMs: number,
) {
  const windows: Record<GrowthRevenueForecastTrendWindow, { bucketDays: number; bucketCount: number }> = {
    "7d": { bucketDays: 1, bucketCount: 7 },
    "30d": { bucketDays: 1, bucketCount: 30 },
    "90d": { bucketDays: 7, bucketCount: 13 },
  }

  const result: Record<
    GrowthRevenueForecastTrendWindow,
    Array<{ label: string; averageProbability: number }>
  > = {
    "7d": [],
    "30d": [],
    "90d": [],
  }

  for (const [window, config] of Object.entries(windows) as [
    GrowthRevenueForecastTrendWindow,
    { bucketDays: number; bucketCount: number },
  ][]) {
    for (let i = config.bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = nowMs - i * config.bucketDays * 24 * 60 * 60 * 1000
      const bucketStart = bucketEnd - config.bucketDays * 24 * 60 * 60 * 1000
      const bucketRows = rows.filter((row) => {
        if (!row.revenue_forecast_computed_at) return false
        const ts = Date.parse(row.revenue_forecast_computed_at)
        return ts >= bucketStart && ts < bucketEnd
      })
      const averageProbability =
        bucketRows.length > 0
          ? Math.round(
              bucketRows.reduce(
                (sum, row) => sum + ((row.revenue_probability_score as number | null) ?? 0),
                0,
              ) / bucketRows.length,
            )
          : 0
      result[window].push({
        label: new Date(bucketStart).toISOString().slice(0, 10),
        averageProbability,
      })
    }
  }

  return result
}
