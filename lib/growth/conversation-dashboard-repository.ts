import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLead } from "@/lib/growth/types"

const TERMINAL = new Set(["converted", "disqualified", "archived"])

const LEAD_SUMMARY_SELECT =
  "id, company_name, contact_name, status, score, conversation_health_score, conversation_health_tier, conversation_summary, conversation_sentiment, conversation_urgency_level, conversation_buying_intent, conversation_momentum, conversation_response_pattern, conversation_competitor_pressure, conversation_trend, conversation_computed_at, next_best_action"

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
  | "conversationHealthScore"
  | "conversationHealthTier"
  | "conversationSummary"
  | "conversationSentiment"
  | "conversationUrgencyLevel"
  | "conversationBuyingIntent"
  | "conversationMomentum"
  | "conversationResponsePattern"
  | "conversationCompetitorPressure"
  | "conversationTrend"
  | "nextBestAction"
> {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    status: row.status as GrowthLead["status"],
    score: row.score as number | null,
    conversationHealthScore: row.conversation_health_score as number | null,
    conversationHealthTier: row.conversation_health_tier as GrowthLead["conversationHealthTier"],
    conversationSummary: row.conversation_summary as string | null,
    conversationSentiment: row.conversation_sentiment as GrowthLead["conversationSentiment"],
    conversationUrgencyLevel: row.conversation_urgency_level as GrowthLead["conversationUrgencyLevel"],
    conversationBuyingIntent: row.conversation_buying_intent as GrowthLead["conversationBuyingIntent"],
    conversationMomentum: row.conversation_momentum as GrowthLead["conversationMomentum"],
    conversationResponsePattern: row.conversation_response_pattern as GrowthLead["conversationResponsePattern"],
    conversationCompetitorPressure: row.conversation_competitor_pressure as number | null,
    conversationTrend: row.conversation_trend as GrowthLead["conversationTrend"],
    nextBestAction: row.next_best_action as GrowthLead["nextBestAction"],
  }
}

export async function fetchGrowthConversationDashboard(admin: SupabaseClient) {
  const { data: leads, error } = await growthLeadsTable(admin)
    .select(`${LEAD_SUMMARY_SELECT}, conversation_objection_profile, conversation_top_signals`)
    .not("status", "in", '("converted","disqualified","archived")')
    .order("conversation_health_score", { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = (leads ?? []).filter((row) => !TERMINAL.has(row.status as string))
  const scores = rows.map((row) => (row.conversation_health_score as number | null) ?? 0)
  const averageHealth =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0

  const strongHealth = rows
    .filter((row) => ["strong", "positive"].includes(String(row.conversation_health_tier)))
    .slice(0, 12)
    .map(summarizeLead)

  const buyingIntent = rows
    .filter((row) => ["strong", "urgent"].includes(String(row.conversation_buying_intent)))
    .slice(0, 12)
    .map(summarizeLead)

  const sentimentShift = rows
    .filter((row) => ["negative", "mixed"].includes(String(row.conversation_sentiment)))
    .slice(0, 12)
    .map(summarizeLead)

  const competitorMentions = rows
    .filter((row) => ((row.conversation_competitor_pressure as number | null) ?? 0) >= 30)
    .slice(0, 12)
    .map(summarizeLead)

  const urgencyTrends = rows
    .filter((row) => ["high", "critical"].includes(String(row.conversation_urgency_level)))
    .slice(0, 12)
    .map(summarizeLead)

  const conversationRisk = rows
    .filter(
      (row) =>
        row.conversation_health_tier === "critical" ||
        row.conversation_momentum === "stalling" ||
        row.conversation_trend === "at_risk",
    )
    .slice(0, 12)
    .map(summarizeLead)

  const objectionCounts = new Map<string, number>()
  for (const row of rows) {
    const profile = row.conversation_objection_profile as { clusters?: Array<{ key: string; count: number }> } | null
    for (const cluster of profile?.clusters ?? []) {
      objectionCounts.set(cluster.key, (objectionCounts.get(cluster.key) ?? 0) + cluster.count)
    }
  }

  const topObjections = [...objectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ key, count }))

  return {
    averageHealth,
    strongHealth,
    buyingIntent,
    sentimentShift,
    competitorMentions,
    topObjections,
    urgencyTrends,
    conversationRisk,
  }
}
