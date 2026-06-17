/** Client-safe inbox conversation overview metrics (Phase 7P). */

import { collectGrowthConversationsDashboardLeads } from "@/lib/growth/navigation/growth-conversations-deep-link"
import type { GrowthConversationsDashboardPayload } from "@/lib/growth/conversations/growth-conversations-dashboard-client"

export const GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER =
  "growth-inbox-conversation-overview-metrics-v1" as const

export type GrowthInboxConversationOverviewMetrics = {
  qaMarker: typeof GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER
  needsAttention: number
  negativeSentiment: number
  highUrgency: number
  strongBuyingIntent: number
  activeConversationLeads: number
  averageHealth: number
}

/** Metrics deferred until dashboard exposes full-portfolio counts or dedicated buckets. */
export const GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_DEFERRED = [
  {
    id: "high-momentum",
    label: "High Momentum",
    reason: "Dashboard buckets are capped at 12 leads; no accelerating-momentum bucket in API payload.",
  },
  {
    id: "recommended-follow-up",
    label: "Recommended Follow-Up",
    reason: "nextBestAction is not aggregated in conversations dashboard response.",
  },
  {
    id: "stalled-conversations",
    label: "Stalled Conversations",
    reason: "Stalling momentum is included in conversationRisk bucket; separate stall-only count deferred.",
  },
] as const

export function deriveGrowthInboxConversationOverviewMetrics(
  dashboard: GrowthConversationsDashboardPayload | null,
): GrowthInboxConversationOverviewMetrics {
  if (!dashboard) {
    return {
      qaMarker: GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER,
      needsAttention: 0,
      negativeSentiment: 0,
      highUrgency: 0,
      strongBuyingIntent: 0,
      activeConversationLeads: 0,
      averageHealth: 0,
    }
  }

  const activeConversationLeads = collectGrowthConversationsDashboardLeads(dashboard).length

  return {
    qaMarker: GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER,
    needsAttention: dashboard.conversationRisk.length,
    negativeSentiment: dashboard.sentimentShift.length,
    highUrgency: dashboard.urgencyTrends.length,
    strongBuyingIntent: dashboard.buyingIntent.length,
    activeConversationLeads,
    averageHealth: dashboard.averageHealth,
  }
}
