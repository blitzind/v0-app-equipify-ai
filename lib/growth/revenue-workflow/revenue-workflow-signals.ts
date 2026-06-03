import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function fetchPendingOpportunityRecommendationScore(
  admin: SupabaseClient,
  leadId: string,
): Promise<number | null> {
  const { data } = await admin
    .schema("growth")
    .from("opportunity_recommendations")
    .select("metadata")
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10)

  let maxScore: number | null = null
  for (const row of data ?? []) {
    const metadata = (row as { metadata?: Record<string, unknown> }).metadata
    const score = metadata?.opportunityScore
    if (typeof score === "number") {
      maxScore = maxScore == null ? score : Math.max(maxScore, score)
    }
  }
  return maxScore
}

export async function fetchReplyUrgencyBoost(admin: SupabaseClient, leadId: string): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("reply_workflow_actions")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .in("action_type", ["create_call_task", "mark_interested"])
  return (count ?? 0) > 0 ? 8 : 0
}

export async function fetchMeetingIntentPending(admin: SupabaseClient, leadId: string): Promise<boolean> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .schema("growth")
    .from("opportunity_signals")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("signal_type", "meeting_interest")
    .gte("detected_at", since)
  return (count ?? 0) > 0
}
