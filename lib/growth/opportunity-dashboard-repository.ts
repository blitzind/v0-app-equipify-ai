import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOpportunityTrendWindow } from "@/lib/growth/opportunity-types"
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
  | "opportunityReadinessScore"
  | "opportunityReadinessTier"
  | "opportunityReadinessSummary"
  | "opportunityReadinessTrend"
  | "opportunityReadinessConfidence"
  | "opportunityBuyingSignalStrength"
  | "opportunityAgeBucket"
  | "opportunityBlockers"
  | "opportunityAccelerators"
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
    opportunityReadinessScore: row.opportunity_readiness_score as number | null,
    opportunityReadinessTier: row.opportunity_readiness_tier as GrowthLead["opportunityReadinessTier"],
    opportunityReadinessSummary: row.opportunity_readiness_summary as string | null,
    opportunityReadinessTrend: row.opportunity_readiness_trend as GrowthLead["opportunityReadinessTrend"],
    opportunityReadinessConfidence: (row.opportunity_readiness_confidence as number | null) ?? 0,
    opportunityBuyingSignalStrength: (row.opportunity_buying_signal_strength ??
      "none") as GrowthLead["opportunityBuyingSignalStrength"],
    opportunityAgeBucket: (row.opportunity_age_bucket ?? "new") as GrowthLead["opportunityAgeBucket"],
    opportunityBlockers: Array.isArray(row.opportunity_blockers)
      ? (row.opportunity_blockers as GrowthLead["opportunityBlockers"])
      : [],
    opportunityAccelerators: Array.isArray(row.opportunity_accelerators)
      ? (row.opportunity_accelerators as GrowthLead["opportunityAccelerators"])
      : [],
    relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
    engagementTier: row.engagement_tier as GrowthLead["engagementTier"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, opportunity_readiness_score, opportunity_readiness_tier, opportunity_readiness_summary, opportunity_readiness_trend, opportunity_readiness_previous_score, opportunity_readiness_confidence, opportunity_buying_signal_strength, opportunity_age_bucket, opportunity_blockers, opportunity_accelerators, relationship_strength_tier, engagement_tier, next_best_action, opportunity_readiness_computed_at"

export async function fetchGrowthOpportunityDashboard(admin: SupabaseClient) {
  const now = Date.now()

  const { data: leads, error } = await growthLeadsTable(admin)
    .select(LEAD_SUMMARY_SELECT)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("opportunity_readiness_score", { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.opportunity_readiness_score as number | null) ?? 0)
  const averageReadiness =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

  const priorityOpportunities = rows
    .filter((row) => row.opportunity_readiness_tier === "priority_opportunity")
    .slice(0, 20)
    .map(summarizeLead)

  const salesReady = rows
    .filter((row) => row.opportunity_readiness_tier === "sales_ready")
    .slice(0, 20)
    .map(summarizeLead)

  const blockedOpportunities = rows
    .filter(
      (row) =>
        Array.isArray(row.opportunity_blockers) &&
        (row.opportunity_blockers as unknown[]).length > 0 &&
        row.opportunity_readiness_tier !== "priority_opportunity",
    )
    .sort(
      (a, b) =>
        ((b.opportunity_blockers as unknown[])?.length ?? 0) -
          ((a.opportunity_blockers as unknown[])?.length ?? 0) ||
        ((b.opportunity_readiness_score as number | null) ?? 0) -
          ((a.opportunity_readiness_score as number | null) ?? 0),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const executiveCloseCandidates = rows
    .filter((row) => {
      const tier = row.opportunity_readiness_tier as string
      const fit = (row.score as number | null) ?? 0
      const relationshipTier = row.relationship_strength_tier as string | null
      const buying = row.opportunity_buying_signal_strength as string
      return (
        (tier === "sales_ready" || tier === "priority_opportunity") &&
        fit > 80 &&
        (relationshipTier === "trusted" || relationshipTier === "strategic") &&
        (buying === "moderate" || buying === "strong")
      )
    })
    .sort(
      (a, b) =>
        ((b.opportunity_readiness_score as number | null) ?? 0) -
        ((a.opportunity_readiness_score as number | null) ?? 0),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const fastestImproving = rows
    .filter(
      (row) =>
        row.opportunity_readiness_previous_score != null &&
        row.opportunity_readiness_score != null &&
        (row.opportunity_readiness_score as number) - (row.opportunity_readiness_previous_score as number) >= 8,
    )
    .sort(
      (a, b) =>
        ((b.opportunity_readiness_score as number) - (b.opportunity_readiness_previous_score as number)) -
        ((a.opportunity_readiness_score as number) - (a.opportunity_readiness_previous_score as number)),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const topBlockers = aggregateTopBlockers(rows)
  const trend = buildOpportunityTrend(rows, now)

  return {
    averageReadiness,
    priorityOpportunities,
    salesReady,
    blockedOpportunities,
    executiveCloseCandidates,
    fastestImproving,
    topBlockers,
    trend,
    tierCounts: {
      not_ready: rows.filter((row) => row.opportunity_readiness_tier === "not_ready").length,
      developing: rows.filter((row) => row.opportunity_readiness_tier === "developing").length,
      qualified: rows.filter((row) => row.opportunity_readiness_tier === "qualified").length,
      sales_ready: rows.filter((row) => row.opportunity_readiness_tier === "sales_ready").length,
      priority_opportunity: rows.filter((row) => row.opportunity_readiness_tier === "priority_opportunity").length,
    },
  }
}

function aggregateTopBlockers(
  rows: Array<{ opportunity_blockers: unknown }>,
): Array<{ key: string; label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>()
  for (const row of rows) {
    if (!Array.isArray(row.opportunity_blockers)) continue
    for (const blocker of row.opportunity_blockers as Array<{ key: string; label: string }>) {
      const existing = counts.get(blocker.key)
      if (existing) existing.count += 1
      else counts.set(blocker.key, { label: blocker.label, count: 1 })
    }
  }
  return [...counts.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function buildOpportunityTrend(
  rows: Array<{ opportunity_readiness_score: number | null; opportunity_readiness_computed_at: string | null }>,
  nowMs: number,
) {
  const windows: Record<GrowthOpportunityTrendWindow, { bucketDays: number; bucketCount: number }> = {
    "7d": { bucketDays: 1, bucketCount: 7 },
    "30d": { bucketDays: 1, bucketCount: 30 },
    "90d": { bucketDays: 7, bucketCount: 13 },
  }

  const result: Record<
    GrowthOpportunityTrendWindow,
    Array<{ label: string; averageReadiness: number }>
  > = {
    "7d": [],
    "30d": [],
    "90d": [],
  }

  for (const [window, config] of Object.entries(windows) as [
    GrowthOpportunityTrendWindow,
    { bucketDays: number; bucketCount: number },
  ][]) {
    for (let i = config.bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = nowMs - i * config.bucketDays * 24 * 60 * 60 * 1000
      const bucketStart = bucketEnd - config.bucketDays * 24 * 60 * 60 * 1000
      const bucketRows = rows.filter((row) => {
        if (!row.opportunity_readiness_computed_at) return false
        const ts = Date.parse(row.opportunity_readiness_computed_at)
        return ts >= bucketStart && ts < bucketEnd
      })
      const averageReadiness =
        bucketRows.length > 0
          ? Math.round(
              bucketRows.reduce(
                (sum, row) => sum + ((row.opportunity_readiness_score as number | null) ?? 0),
                0,
              ) / bucketRows.length,
            )
          : 0
      result[window].push({
        label: new Date(bucketStart).toISOString().slice(0, 10),
        averageReadiness,
      })
    }
  }

  return result
}
