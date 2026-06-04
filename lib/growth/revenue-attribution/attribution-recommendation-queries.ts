import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAttributionTouch } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import type { GrowthRevenueAttributionDashboardFilters } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

type Row = Record<string, unknown>

export async function loadCtaCategorySignals(
  admin: SupabaseClient,
  filters: GrowthRevenueAttributionDashboardFilters,
  wonLeadIds: string[],
): Promise<Array<{ key: string; label: string; sendCount: number; wins: number; positiveReplies: number }>> {
  const since = filters.dateFrom
  const { data, error } = await admin
    .schema("growth")
    .from("outreach_performance_attributions")
    .select("cta_category, lead_id, recorded_at")
    .gte("recorded_at", since)
    .lte("recorded_at", filters.dateTo)
    .limit(1000)
  if (error) return []

  const wonSet = new Set(wonLeadIds)
  const buckets = new Map<string, { sendCount: number; wins: number; positiveReplies: number }>()

  for (const row of data ?? []) {
    const r = row as Row
    const key = String(r.cta_category ?? "unknown")
    const leadId = r.lead_id ? String(r.lead_id) : null
    const bucket = buckets.get(key) ?? { sendCount: 0, wins: 0, positiveReplies: 0 }
    bucket.sendCount += 1
    if (leadId && wonSet.has(leadId)) bucket.wins += 1
    buckets.set(key, bucket)
  }

  let campaignPositive = 0
  try {
    const { data: campaignRows } = await admin
      .schema("growth")
      .from("campaign_revenue_attribution_snapshots")
      .select("positive_replies")
      .gte("snapshot_date", since.slice(0, 10))
      .limit(200)
    for (const row of campaignRows ?? []) {
      campaignPositive += Number((row as Row).positive_replies ?? 0)
    }
  } catch {
    campaignPositive = 0
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: `CTA: ${key}`,
      sendCount: bucket.sendCount,
      wins: bucket.wins,
      positiveReplies: bucket.positiveReplies + (key === "unknown" ? 0 : Math.round(campaignPositive / Math.max(buckets.size, 1))),
    }))
    .sort((a, b) => b.wins - a.wins || b.sendCount - a.sendCount)
}

export async function loadPainPointSignals(
  admin: SupabaseClient,
  wonTouches: GrowthAttributionTouch[],
): Promise<Array<{ key: string; label: string; winCount: number; leadCount: number }>> {
  const generationIds = [
    ...new Set(
      wonTouches
        .filter((t) => t.touchType === "personalization")
        .map((t) => t.metadata?.generation_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]
  if (generationIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("personalization_evidence")
    .select("generation_id, claim_key, evidence_snippet")
    .in("generation_id", generationIds.slice(0, 100))
    .eq("claim_key", "research_pain_point")
    .limit(300)
  if (error) return []

  const buckets = new Map<string, { label: string; winCount: number; leadIds: Set<string> }>()
  const touchByGen = new Map<string, GrowthAttributionTouch>()
  for (const touch of wonTouches) {
    const genId = touch.metadata?.generation_id
    if (typeof genId === "string") touchByGen.set(genId, touch)
  }

  for (const row of data ?? []) {
    const r = row as Row
    const snippet = String(r.evidence_snippet ?? "").trim().slice(0, 80)
    if (!snippet) continue
    const key = snippet.toLowerCase().replace(/\s+/g, "_").slice(0, 64)
    const touch = touchByGen.get(String(r.generation_id))
    const bucket = buckets.get(key) ?? { label: snippet, winCount: 0, leadIds: new Set<string>() }
    bucket.winCount += 1
    if (touch) bucket.leadIds.add(touch.leadId)
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      winCount: bucket.winCount,
      leadCount: bucket.leadIds.size,
    }))
    .sort((a, b) => b.winCount - a.winCount)
}

export async function loadSequenceSnapshotHints(
  admin: SupabaseClient,
): Promise<Array<{ sequenceId: string; replyPct: number; revenue: number }>> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_performance_snapshots")
    .select("sequence_id, metrics")
    .eq("period_key", "30d")
    .order("snapshot_at", { ascending: false })
    .limit(100)
  if (error) return []

  const seen = new Set<string>()
  const results: Array<{ sequenceId: string; replyPct: number; revenue: number }> = []
  for (const row of data ?? []) {
    const r = row as Row
    const sequenceId = r.sequence_id ? String(r.sequence_id) : ""
    if (!sequenceId || seen.has(sequenceId)) continue
    seen.add(sequenceId)
    const metrics = (r.metrics as Record<string, number>) ?? {}
    results.push({
      sequenceId,
      replyPct: Number(metrics.reply_pct ?? 0),
      revenue: Number(metrics.revenue ?? 0),
    })
  }
  return results
}
