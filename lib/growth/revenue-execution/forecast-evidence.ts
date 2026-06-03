import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchPendingOpportunityRecommendationScore } from "@/lib/growth/revenue-workflow/revenue-workflow-signals"
import { readGrowthLeadRevenueReadinessSnapshot } from "@/lib/growth/revenue-workflow/recompute-revenue-readiness"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthRevenueForecastEvidence,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

export async function fetchGrowthRevenueForecastEvidence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthRevenueForecastEvidence | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const [memory, oppRecScore, signalsRes, recRes] = await Promise.all([
    buildLeadMemoryInfluenceContext(admin, leadId).catch(() => null),
    fetchPendingOpportunityRecommendationScore(admin, leadId),
    admin
      .schema("growth")
      .from("opportunity_signals")
      .select("evidence_snippet, signal_type")
      .eq("lead_id", leadId)
      .order("detected_at", { ascending: false })
      .limit(8),
    admin
      .schema("growth")
      .from("opportunity_recommendations")
      .select("metadata")
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const readiness = readGrowthLeadRevenueReadinessSnapshot(lead.metadata)
  const recMeta = (recRes.data as { metadata?: Record<string, unknown> } | null)?.metadata
  const oppConfidence =
    typeof recMeta?.confidence === "number" ? recMeta.confidence : null

  const buyingSignals = (signalsRes.data ?? []).map((row) =>
    String((row as { evidence_snippet?: string }).evidence_snippet ?? (row as { signal_type: string }).signal_type),
  )

  const parts: string[] = []
  if (readiness?.score != null) parts.push(`Revenue readiness ${readiness.score} (${readiness.tier})`)
  if (oppRecScore != null) parts.push(`Opportunity recommendation score ${oppRecScore}`)
  if (lead.revenueProbabilityTier) parts.push(`Forecast tier ${lead.revenueProbabilityTier}`)
  if ((memory?.unresolvedObjectionCount ?? 0) > 0) parts.push(`${memory!.unresolvedObjectionCount} open objection(s)`)

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    leadId,
    forecastScore: lead.revenueProbabilityScore,
    forecastTier: lead.revenueProbabilityTier,
    revenueReadinessScore: readiness?.score ?? null,
    revenueReadinessTier: readiness?.tier ?? null,
    opportunityRecommendationScore: oppRecScore,
    opportunityConfidence: oppConfidence,
    buyingSignals: buyingSignals.slice(0, 6),
    commitments: memory?.commitmentSummaries?.slice(0, 4) ?? [],
    objections: memory?.topObjections?.slice(0, 4) ?? [],
    memoryCoverageScore: memory?.memoryCoverageScore ?? null,
    relationshipStage: memory?.relationshipStage ?? null,
    engagementTrend: memory?.engagementTrend ?? null,
    summary: parts.length ? parts.join(" · ") : "Limited forecast evidence available.",
  }
}
