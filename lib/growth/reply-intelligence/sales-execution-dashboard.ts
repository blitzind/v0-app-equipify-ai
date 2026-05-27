import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAggregateCampaignReplyLearning } from "@/lib/growth/reply-intelligence/campaign-reply-learning"
import {
  GROWTH_REPLY_INTELLIGENCE_QA_MARKER,
  GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
  type GrowthSalesExecutionDashboard,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import { fetchGrowthReplyInboxDashboard } from "@/lib/growth/reply-intelligence/reply-inbox-dashboard-repository"
import { isReplyOverdue } from "@/lib/growth/reply-intelligence/reply-sla-tracker"

export async function fetchGrowthSalesExecutionDashboard(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null; since?: string },
): Promise<GrowthSalesExecutionDashboard> {
  const base = await fetchGrowthReplyInboxDashboard(admin, input)

  let query = admin
    .schema("growth")
    .from("outbound_replies")
    .select("intent, priority, confidence_tier, uncertainty_state, unanswered, reply_sla_due_at, received_at")
    .not("intelligence_processed_at", "is", null)

  if (input?.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input?.since) query = query.gte("received_at", input.since)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const now = Date.now()

  const needsReviewCount = rows.filter((row) => {
    const tier = row.confidence_tier as string | null
    const uncertainty = row.uncertainty_state as string | null
    return tier === "low" || tier === "uncertain" || uncertainty === "ambiguous" || row.unanswered === true
  }).length

  const workflowRes = await admin
    .schema("growth")
    .from("reply_workflow_actions")
    .select("id", { count: "exact", head: true })
    .eq("action_status", "pending_review")

  const campaignLearning = await fetchAggregateCampaignReplyLearning(admin, { sinceDays: 30 }).catch(() => ({
    positiveReplyRate: 0,
    objectionRate: 0,
    unsubscribeReplyRate: 0,
    demoRequestRate: 0,
    pricingQuestionRate: 0,
  }))

  return {
    ...base,
    qaMarker: GROWTH_REPLY_INTELLIGENCE_QA_MARKER,
    v2QaMarker: GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
    needsReviewCount,
    interestedCount: rows.filter((row) =>
      ["positive_interest", "meeting_request", "demo_request"].includes(String(row.intent)),
    ).length,
    demoRequestCount: rows.filter((row) => ["demo_request", "meeting_request"].includes(String(row.intent))).length,
    pricingQuestionCount: rows.filter((row) => row.intent === "pricing_question").length,
    objectionHeavyCount: rows.filter((row) =>
      ["objection", "timing_delay", "competitor_mention", "angry_complaint"].includes(String(row.intent)),
    ).length,
    stopUnsubscribeCount: rows.filter((row) =>
      ["unsubscribe", "not_interested", "wrong_contact"].includes(String(row.intent)),
    ).length,
    angryComplaintCount: rows.filter((row) => row.intent === "angry_complaint").length,
    lowConfidenceCount: rows.filter((row) =>
      ["low", "uncertain"].includes(String(row.confidence_tier)),
    ).length,
    workflowTaskCount: workflowRes.count ?? 0,
    campaignLearning,
    overdueCount: rows.filter((row) => {
      if (!row.reply_sla_due_at || !row.priority) return false
      return isReplyOverdue(row.received_at as string, row.priority as "critical" | "high" | "medium" | "low", now)
    }).length,
  }
}
