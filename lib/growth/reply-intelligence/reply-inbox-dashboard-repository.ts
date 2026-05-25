import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isReplyOverdue } from "@/lib/growth/reply-intelligence/reply-sla-tracker"
import {
  GROWTH_REPLY_INTELLIGENCE_QA_MARKER,
  type GrowthReplyInboxDashboard,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

export async function fetchGrowthReplyInboxDashboard(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null; since?: string },
): Promise<GrowthReplyInboxDashboard> {
  let query = admin
    .schema("growth")
    .from("outbound_replies")
    .select("priority, intent, unanswered, owner_waiting, reply_sla_due_at, response_latency_ms, received_at")
    .not("intelligence_processed_at", "is", null)

  if (input?.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input?.since) query = query.gte("received_at", input.since)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const now = Date.now()
  let latencyTotal = 0
  let latencyCount = 0
  const trendMap = new Map<string, number>()

  for (const row of rows) {
    if (typeof row.response_latency_ms === "number" && row.response_latency_ms > 0) {
      latencyTotal += row.response_latency_ms
      latencyCount += 1
    }
    const day = new Date(row.received_at as string).toISOString().slice(0, 10)
    trendMap.set(day, (trendMap.get(day) ?? 0) + 1)
  }

  const overdueCount = rows.filter((row) => {
    if (!row.reply_sla_due_at || !row.priority) return false
    return isReplyOverdue(row.received_at as string, row.priority as "critical" | "high" | "medium" | "low", now)
  }).length

  const replyTrend = [...trendMap.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(-14)
    .map(([label, count]) => ({ label, count }))

  return {
    qaMarker: GROWTH_REPLY_INTELLIGENCE_QA_MARKER,
    totalReplies: rows.length,
    highPriorityCount: rows.filter((row) => row.priority === "high").length,
    criticalCount: rows.filter((row) => row.priority === "critical").length,
    meetingRequestCount: rows.filter((row) => row.intent === "meeting_request").length,
    competitorMentionCount: rows.filter((row) => row.intent === "competitor_mention").length,
    unansweredCount: rows.filter((row) => row.unanswered === true).length,
    ownerWaitingCount: rows.filter((row) => row.owner_waiting === true).length,
    overdueCount,
    averageResponseLatencyMs: latencyCount > 0 ? Math.round(latencyTotal / latencyCount) : 0,
    replyTrend,
  }
}
