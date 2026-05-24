import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listActiveGrowthRealtimeCallSessions,
  listRecentGrowthRealtimeCallSessions,
} from "@/lib/growth/realtime/realtime-call-repository"

export async function fetchGrowthRealtimeLiveDashboard(admin: SupabaseClient) {
  const recent = await listRecentGrowthRealtimeCallSessions(admin, 80)
  const liveSessions = await listActiveGrowthRealtimeCallSessions(admin, 30)

  const completedToday = recent.filter((session) => session.status === "completed")
  const objectionCounts = new Map<string, number>()
  const buyingCounts = new Map<string, number>()
  const riskCounts = new Map<string, number>()
  const talkRatios: number[] = []
  const discoveryMissingCounts = new Map<string, number>()

  for (const session of completedToday) {
    for (const objection of session.liveSnapshot.objections) {
      objectionCounts.set(objection.key, (objectionCounts.get(objection.key) ?? 0) + 1)
    }
    for (const signal of session.liveSnapshot.buyingSignals) {
      buyingCounts.set(signal.key, (buyingCounts.get(signal.key) ?? 0) + 1)
    }
    for (const flag of session.liveSnapshot.riskFlags) {
      riskCounts.set(flag, (riskCounts.get(flag) ?? 0) + 1)
    }
    if (session.liveSnapshot.talkRatio.repWordCount + session.liveSnapshot.talkRatio.prospectWordCount > 0) {
      talkRatios.push(session.liveSnapshot.talkRatio.repTalkPercent)
    }
    for (const area of session.liveSnapshot.discovery.missing) {
      discoveryMissingCounts.set(area, (discoveryMissingCounts.get(area) ?? 0) + 1)
    }
  }

  const avgRepTalkPercent =
    talkRatios.length > 0 ? Math.round(talkRatios.reduce((sum, value) => sum + value, 0) / talkRatios.length) : 0

  return {
    liveSessions: liveSessions.map((session) => ({
      id: session.id,
      leadId: session.leadId,
      companyName: session.companyName,
      status: session.status,
      transcriptStatus: session.transcriptStatus,
      riskFlags: session.liveSnapshot.riskFlags,
      talkRatio: session.liveSnapshot.talkRatio,
      updatedAt: session.updatedAt,
    })),
    topObjections: [...objectionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => ({ key, count })),
    buyingSignalsDetected: [...buyingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => ({ key, count })),
    riskMonitoringTrends: [...riskCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([flag, count]) => ({ flag, count })),
    talkRatioTrends: {
      averageRepTalkPercent: avgRepTalkPercent,
      inGoalRangeCount: talkRatios.filter((value) => value >= 45 && value <= 60).length,
      sampleSize: talkRatios.length,
    },
    discoveryCoverage: [...discoveryMissingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([area, count]) => ({ area, missingCount: count })),
    stats: {
      liveCount: liveSessions.filter((session) => session.status === "active").length,
      preparingCount: liveSessions.filter((session) => session.status === "preparing").length,
      completedToday: completedToday.length,
    },
  }
}
