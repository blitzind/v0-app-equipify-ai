import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthRelationshipTrendWindow } from "@/lib/growth/relationship-types"
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
  | "relationshipStrengthScore"
  | "relationshipStrengthTier"
  | "relationshipLastMeaningfulTouchAt"
  | "relationshipSummary"
  | "relationshipTrend"
  | "relationshipOwnerAttentionLevel"
  | "relationshipRecoveryAttemptCount"
  | "engagementTier"
  | "nextBestAction"
> {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    status: row.status as GrowthLead["status"],
    score: row.score as number | null,
    relationshipStrengthScore: row.relationship_strength_score as number | null,
    relationshipStrengthTier: row.relationship_strength_tier as GrowthLead["relationshipStrengthTier"],
    relationshipLastMeaningfulTouchAt: row.relationship_last_meaningful_touch_at as string | null,
    relationshipSummary: row.relationship_summary as string | null,
    relationshipTrend: row.relationship_trend as GrowthLead["relationshipTrend"],
    relationshipOwnerAttentionLevel: (row.relationship_owner_attention_level ??
      "none") as GrowthLead["relationshipOwnerAttentionLevel"],
    relationshipRecoveryAttemptCount: (row.relationship_recovery_attempt_count as number | null) ?? 0,
    engagementTier: row.engagement_tier as GrowthLead["engagementTier"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, relationship_strength_score, relationship_strength_tier, relationship_last_meaningful_touch_at, relationship_summary, relationship_trend, relationship_previous_score, relationship_owner_attention_level, relationship_recovery_attempt_count, engagement_tier, next_best_action, relationship_computed_at"

export async function fetchGrowthRelationshipDashboard(admin: SupabaseClient) {
  const now = Date.now()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: leads, error } = await growthLeadsTable(admin)
    .select(`${LEAD_SUMMARY_SELECT}`)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("relationship_strength_score", { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.relationship_strength_score as number | null) ?? 0)
  const averageRelationshipStrength =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

  const trustedRelationships = rows
    .filter((row) => row.relationship_strength_tier === "trusted")
    .slice(0, 20)
    .map(summarizeLead)

  const strategicRelationships = rows
    .filter((row) => row.relationship_strength_tier === "strategic")
    .slice(0, 20)
    .map(summarizeLead)

  const relationshipCooling = rows
    .filter((row) => row.relationship_trend === "cooling")
    .slice(0, 20)
    .map(summarizeLead)

  const executiveAttentionRequired = rows
    .filter(
      (row) =>
        row.relationship_owner_attention_level === "important" ||
        row.relationship_owner_attention_level === "critical",
    )
    .sort((a, b) => {
      const rank = (level: string) => (level === "critical" ? 2 : 1)
      return (
        rank(b.relationship_owner_attention_level as string) -
          rank(a.relationship_owner_attention_level as string) ||
        ((b.relationship_strength_score as number | null) ?? 0) -
          ((a.relationship_strength_score as number | null) ?? 0)
      )
    })
    .slice(0, 20)
    .map(summarizeLead)

  const fastestGrowing = rows
    .filter(
      (row) =>
        row.relationship_previous_score != null &&
        row.relationship_strength_score != null &&
        (row.relationship_strength_score as number) - (row.relationship_previous_score as number) >= 8,
    )
    .sort(
      (a, b) =>
        ((b.relationship_strength_score as number) - (b.relationship_previous_score as number)) -
        ((a.relationship_strength_score as number) - (a.relationship_previous_score as number)),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const topTouchedLeads = rows
    .filter(
      (row) =>
        row.relationship_last_meaningful_touch_at &&
        (row.relationship_last_meaningful_touch_at as string) >= since30d,
    )
    .sort(
      (a, b) =>
        Date.parse(b.relationship_last_meaningful_touch_at as string) -
        Date.parse(a.relationship_last_meaningful_touch_at as string),
    )
    .slice(0, 20)
    .map(summarizeLead)

  const recentlyImproving = rows
    .filter((row) => row.relationship_trend === "improving")
    .slice(0, 20)
    .map(summarizeLead)

  const trend = buildRelationshipTrend(rows, now)

  return {
    averageRelationshipStrength,
    trustedRelationships,
    strategicRelationships,
    relationshipCooling,
    executiveAttentionRequired,
    fastestGrowing,
    topTouchedLeads,
    recentlyImproving,
    trend,
    tierCounts: {
      unknown: rows.filter((row) => row.relationship_strength_tier === "unknown").length,
      developing: rows.filter((row) => row.relationship_strength_tier === "developing").length,
      active: rows.filter((row) => row.relationship_strength_tier === "active").length,
      trusted: rows.filter((row) => row.relationship_strength_tier === "trusted").length,
      strategic: rows.filter((row) => row.relationship_strength_tier === "strategic").length,
    },
    trendCounts: {
      improving: rows.filter((row) => row.relationship_trend === "improving").length,
      stable: rows.filter((row) => row.relationship_trend === "stable").length,
      cooling: rows.filter((row) => row.relationship_trend === "cooling").length,
    },
    touchedLast7d: rows.filter(
      (row) =>
        row.relationship_last_meaningful_touch_at &&
        (row.relationship_last_meaningful_touch_at as string) >= since7d,
    ).length,
  }
}

function buildRelationshipTrend(
  rows: Array<{ relationship_last_meaningful_touch_at: string | null; relationship_trend: string | null }>,
  nowMs: number,
) {
  const windows: Record<GrowthRelationshipTrendWindow, { bucketDays: number; bucketCount: number }> = {
    "7d": { bucketDays: 1, bucketCount: 7 },
    "30d": { bucketDays: 1, bucketCount: 30 },
    "90d": { bucketDays: 7, bucketCount: 13 },
  }

  const result: Record<
    GrowthRelationshipTrendWindow,
    Array<{ label: string; meaningfulTouches: number }>
  > = {
    "7d": [],
    "30d": [],
    "90d": [],
  }

  for (const [window, config] of Object.entries(windows) as [
    GrowthRelationshipTrendWindow,
    { bucketDays: number; bucketCount: number },
  ][]) {
    for (let i = config.bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = nowMs - i * config.bucketDays * 24 * 60 * 60 * 1000
      const bucketStart = bucketEnd - config.bucketDays * 24 * 60 * 60 * 1000
      const meaningfulTouches = rows.filter((row) => {
        if (!row.relationship_last_meaningful_touch_at) return false
        const ts = Date.parse(row.relationship_last_meaningful_touch_at)
        return ts >= bucketStart && ts < bucketEnd
      }).length
      result[window].push({
        label: new Date(bucketStart).toISOString().slice(0, 10),
        meaningfulTouches,
      })
    }
  }

  return result
}
