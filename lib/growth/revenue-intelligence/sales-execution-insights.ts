import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"
import type { GrowthSalesExecutionInsights } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export async function upsertSalesExecutionInsightSnapshot(
  admin: SupabaseClient,
  input: {
    scopeType: "global" | "operator" | "campaign" | "sender" | "domain" | "sequence"
    scopeId?: string | null
    insights: GrowthSalesExecutionInsights
  },
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)

  const { data: existing } = await admin
    .schema("growth")
    .from("sales_execution_insight_snapshots")
    .select("id")
    .eq("snapshot_date", snapshotDate)
    .eq("scope_type", input.scopeType)
    .eq("scope_id", input.scopeId ?? null)
    .maybeSingle()

  const row = {
    snapshot_date: snapshotDate,
    scope_type: input.scopeType,
    scope_id: input.scopeId ?? null,
    reply_quality_score: input.insights.replyQualityScore,
    objection_resolution_rate: input.insights.objectionResolutionRate,
    meeting_conversion_rate: input.insights.meetingConversionRate,
    opportunity_conversion_rate: input.insights.opportunityConversionRate,
    operator_response_quality: input.insights.operatorResponseQuality,
    metrics: {
      campaign_opportunity_conversion: input.insights.campaignOpportunityConversion,
      sender_effectiveness: input.insights.senderEffectiveness,
      domain_effectiveness: input.insights.domainEffectiveness,
      sequence_effectiveness: input.insights.sequenceEffectiveness,
    },
    qa_marker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await admin.schema("growth").from("sales_execution_insight_snapshots").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("sales_execution_insight_snapshots").insert(row)
  }
}

export async function computeGlobalSalesExecutionInsights(admin: SupabaseClient): Promise<GrowthSalesExecutionInsights> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [repliesRes, workflowRes, opportunitiesRes] = await Promise.all([
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("confidence, intent, priority")
      .gte("received_at", since)
      .not("intelligence_processed_at", "is", null),
    admin
      .schema("growth")
      .from("reply_workflow_actions")
      .select("action_type, action_status")
      .gte("created_at", since),
    admin.schema("growth").from("opportunities").select("id, stage").gte("created_at", since),
  ])

  let meetings: Array<{ status?: string }> = []
  try {
    const meetingsRes = await admin.schema("growth").from("meetings").select("id, status").gte("created_at", since)
    meetings = (meetingsRes.data ?? []) as Array<{ status?: string }>
  } catch {
    meetings = []
  }

  const replies = repliesRes.data ?? []
  const workflows = workflowRes.data ?? []
  const opportunities = opportunitiesRes.data ?? []

  const highConfidence = replies.filter((r) => (r as { confidence?: number }).confidence >= 0.7).length
  const replyQualityScore = replies.length > 0 ? Math.round((highConfidence / replies.length) * 100) : 100

  const objectionActions = workflows.filter((w) => String((w as { action_type?: string }).action_type).includes("objection")).length
  const resolvedObjections = workflows.filter(
    (w) => (w as { action_status?: string }).action_status === "completed" || (w as { action_status?: string }).action_status === "approved",
  ).length
  const objectionResolutionRate =
    objectionActions > 0 ? Math.round((resolvedObjections / objectionActions) * 1000) / 10 : 0

  const completedMeetings = meetings.filter((m) => m.status === "completed" || m.status === "scheduled").length
  const meetingConversionRate = replies.length > 0 ? Math.round((completedMeetings / replies.length) * 1000) / 10 : 0

  const opportunityConversionRate = replies.length > 0 ? Math.round((opportunities.length / replies.length) * 1000) / 10 : 0

  return {
    replyQualityScore,
    objectionResolutionRate,
    meetingConversionRate,
    opportunityConversionRate,
    campaignOpportunityConversion: opportunityConversionRate,
    senderEffectiveness: replyQualityScore,
    domainEffectiveness: replyQualityScore,
    sequenceEffectiveness: opportunityConversionRate,
    operatorResponseQuality: objectionResolutionRate > 0 ? objectionResolutionRate : replyQualityScore,
  }
}
