import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import type { GrowthRevenueReadinessInput } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthLead } from "@/lib/growth/types"

export async function fetchGrowthLeadRevenueReadinessInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthRevenueReadinessInput> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [memory, emailSummary, replyRes, signalRes, meetingRes] = await Promise.all([
    buildLeadMemoryInfluenceContext(admin, lead.id),
    fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id, intent, received_at")
      .eq("lead_id", lead.id)
      .gte("received_at", since30d),
    admin
      .schema("growth")
      .from("opportunity_signals")
      .select("signal_type")
      .eq("lead_id", lead.id)
      .gte("detected_at", since30d),
    admin
      .schema("growth")
      .from("meetings")
      .select("id, status")
      .eq("lead_id", lead.id)
      .gte("created_at", since30d)
      .then((result) => result)
      .catch(() => ({ data: [], error: null })),
  ])

  const signalTypes = (signalRes.data ?? []).map((row) => String((row as { signal_type: string }).signal_type))
  const buyingSignalCount = signalTypes.filter((type) =>
    ["meeting_interest", "proposal_request", "budget_signal", "pricing_interest", "timeline_interest", "urgency_signal"].includes(type),
  ).length
  const meetingIntentSignals = signalTypes.filter((type) => type === "meeting_interest").length
  const pricingIntentSignals =
    signalTypes.filter((type) => type === "pricing_interest" || type === "budget_signal").length

  return {
    relationshipStage: memory.relationshipStage,
    engagementTrend: memory.engagementTrend ?? lead.relationshipTrend,
    memoryCoverageScore: memory.memoryCoverageScore,
    replyCount30d: replyRes.data?.length ?? 0,
    buyingSignalCount,
    meetingIntentSignals,
    pricingIntentSignals,
    unresolvedObjectionCount: memory.unresolvedObjectionCount,
    commitmentCount: memory.commitmentSummaries?.length ?? 0,
    connectedCallCount: lead.connectedCallCount,
    meetingActivityCount: meetingRes.data?.length ?? 0,
    opportunityReadinessScore: lead.opportunityReadinessScore,
    hasPositiveReply: emailSummary.latestReplyClassification === "interested",
    workflowHealth: lead.workflowHealth,
  }
}
