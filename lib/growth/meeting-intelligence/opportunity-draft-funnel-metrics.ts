/** Opportunity Draft funnel metrics — server-only aggregation. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
  type OpportunityDraftFunnelMetrics,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

const DRAFTS_TABLE = "opportunity_drafts"
const MEETINGS_TABLE = "meetings"

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

export async function buildOpportunityDraftFunnelMetrics(
  admin: SupabaseClient,
): Promise<OpportunityDraftFunnelMetrics> {
  const [{ count: meetingsCompleted }, { data: drafts }] = await Promise.all([
    admin
      .schema("growth")
      .from(MEETINGS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    admin
      .schema("growth")
      .from(DRAFTS_TABLE)
      .select(
        "status, opportunity_readiness_score, confidence_score, estimated_value",
      ),
  ])

  const draftRows = drafts ?? []
  const readinessScores = draftRows.map((row) => Number(row.opportunity_readiness_score ?? 0))
  const confidenceScores = draftRows.map((row) => Number(row.confidence_score ?? 0))
  const estimatedValues = draftRows.map((row) => Number(row.estimated_value ?? 0))

  return {
    qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
    meetings_completed: meetingsCompleted ?? 0,
    drafts_generated: draftRows.length,
    drafts_approved: draftRows.filter((row) => row.status === "approved").length,
    drafts_rejected: draftRows.filter((row) => row.status === "rejected").length,
    average_readiness_score: average(readinessScores),
    average_confidence_score: average(confidenceScores),
    average_estimated_value: average(estimatedValues),
    computed_at: new Date().toISOString(),
  }
}
