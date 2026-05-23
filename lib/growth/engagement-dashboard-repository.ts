import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthEngagementTrendWindow } from "@/lib/growth/engagement-types"
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
  | "engagementScore"
  | "engagementTier"
  | "engagementLastActivityAt"
  | "engagementSummary"
  | "workflowHealth"
  | "nextBestAction"
> {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    status: row.status as GrowthLead["status"],
    score: row.score as number | null,
    engagementScore: row.engagement_score as number | null,
    engagementTier: row.engagement_tier as GrowthLead["engagementTier"],
    engagementLastActivityAt: row.engagement_last_activity_at as string | null,
    engagementSummary: row.engagement_summary as string | null,
    workflowHealth: row.workflow_health as GrowthLead["workflowHealth"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, engagement_score, engagement_tier, engagement_last_activity_at, engagement_summary, workflow_health, next_best_action"

export async function fetchGrowthEngagementDashboard(admin: SupabaseClient) {
  const now = Date.now()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: leads, error } = await growthLeadsTable(admin)
    .select(`${LEAD_SUMMARY_SELECT}, engagement_computed_at`)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("engagement_score", { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.engagement_score as number | null) ?? 0)
  const averageEngagement =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0

  const hotLeads = rows.filter((row) => row.engagement_tier === "hot").slice(0, 20).map(summarizeLead)
  const engagedLeads = rows
    .filter((row) => row.engagement_tier === "engaged")
    .slice(0, 20)
    .map(summarizeLead)
  const recentlyActive = rows
    .filter(
      (row) =>
        row.engagement_last_activity_at &&
        (row.engagement_last_activity_at as string) >= since7d,
    )
    .slice(0, 20)
    .map(summarizeLead)
  const needsAttention = rows
    .filter(
      (row) =>
        (row.workflow_health === "needs_attention" || row.workflow_health === "stalled") &&
        (row.engagement_tier === "engaged" || row.engagement_tier === "hot"),
    )
    .slice(0, 20)
    .map(summarizeLead)
  const noActivity30d = rows
    .filter(
      (row) =>
        !row.engagement_last_activity_at ||
        (row.engagement_last_activity_at as string) < since30d,
    )
    .slice(0, 20)
    .map(summarizeLead)

  const trend = buildEngagementTrend(rows, now)

  return {
    averageEngagement,
    hotLeads,
    engagedLeads,
    recentlyActive,
    needsAttention,
    noActivity30d,
    trend,
  }
}

function buildEngagementTrend(
  rows: Array<{ engagement_last_activity_at: string | null }>,
  nowMs: number,
) {
  const windows: Record<GrowthEngagementTrendWindow, { bucketDays: number; bucketCount: number }> = {
    "7d": { bucketDays: 1, bucketCount: 7 },
    "30d": { bucketDays: 1, bucketCount: 30 },
    "90d": { bucketDays: 7, bucketCount: 13 },
  }

  const result: Record<
    GrowthEngagementTrendWindow,
    Array<{ label: string; activeLeads: number }>
  > = {
    "7d": [],
    "30d": [],
    "90d": [],
  }

  for (const [window, config] of Object.entries(windows) as [
    GrowthEngagementTrendWindow,
    { bucketDays: number; bucketCount: number },
  ][]) {
    for (let i = config.bucketCount - 1; i >= 0; i -= 1) {
      const bucketEnd = nowMs - i * config.bucketDays * 24 * 60 * 60 * 1000
      const bucketStart = bucketEnd - config.bucketDays * 24 * 60 * 60 * 1000
      const activeLeads = rows.filter((row) => {
        if (!row.engagement_last_activity_at) return false
        const ts = Date.parse(row.engagement_last_activity_at)
        return ts >= bucketStart && ts < bucketEnd
      }).length
      result[window].push({
        label: new Date(bucketStart).toISOString().slice(0, 10),
        activeLeads,
      })
    }
  }

  return result
}
