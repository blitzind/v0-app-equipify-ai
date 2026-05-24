import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeCallExecutionScore, computeLiveRiskLevel } from "@/lib/growth/live-guidance/live-execution-score"
import { listRecentLiveGuidanceEvents } from "@/lib/growth/live-guidance/live-guidance-repository"
import { listRecentGrowthRealtimeCallSessions } from "@/lib/growth/realtime/realtime-call-repository"

const DISCOVERY_AREAS = 5

export async function fetchGrowthLiveCoachingDashboard(admin: SupabaseClient) {
  const recentSessions = await listRecentGrowthRealtimeCallSessions(admin, 100)
  const guidanceEvents = await listRecentLiveGuidanceEvents(admin, 400)

  const completedSessions = recentSessions.filter((session) => session.status === "completed")
  const objectionCounts = new Map<string, number>()
  const talkRatioBuckets = { underGoal: 0, inGoal: 0, overGoal: 0, sampleSize: 0 }
  const executionScores: number[] = []
  const buyingSignalSessions = { withSignals: 0, total: 0 }
  const discoveryCompletionScores: number[] = []
  const guidanceEffectiveness = new Map<string, { surfaced: number; accepted: number; title: string }>()
  const operatorStats = new Map<string, { sessions: number; acceptedGuidance: number; totalScore: number }>()
  const highRiskCalls: Array<{
    sessionId: string
    leadId: string
    companyName: string
    riskLevel: string
    riskFlags: string[]
    executionScore: number
    updatedAt: string
  }> = []

  for (const session of completedSessions) {
    const snapshot = session.liveSnapshot
    for (const objection of snapshot.objections) {
      objectionCounts.set(objection.key, (objectionCounts.get(objection.key) ?? 0) + 1)
    }

    if (snapshot.talkRatio.repWordCount + snapshot.talkRatio.prospectWordCount > 0) {
      talkRatioBuckets.sampleSize += 1
      if (snapshot.talkRatio.inGoalRange) talkRatioBuckets.inGoal += 1
      else if (snapshot.talkRatio.repTalkPercent > 65) talkRatioBuckets.overGoal += 1
      else talkRatioBuckets.underGoal += 1
    }

    buyingSignalSessions.total += 1
    if (snapshot.buyingSignals.length > 0) buyingSignalSessions.withSignals += 1

    const discoveryPct = Math.round((snapshot.discovery.covered.length / DISCOVERY_AREAS) * 100)
    discoveryCompletionScores.push(discoveryPct)

    const sessionGuidance = guidanceEvents.filter((event) => event.realtimeCallSessionId === session.id)
    const acceptedCount = sessionGuidance.filter((event) => event.acceptedAt).length
    const score = computeCallExecutionScore({
      snapshot,
      events: [],
      acceptedGuidanceCount: acceptedCount,
    })
    executionScores.push(score.score)

    const operatorKey = session.createdBy ?? "unknown"
    const operator = operatorStats.get(operatorKey) ?? { sessions: 0, acceptedGuidance: 0, totalScore: 0 }
    operator.sessions += 1
    operator.acceptedGuidance += acceptedCount
    operator.totalScore += score.score
    operatorStats.set(operatorKey, operator)

    const riskLevel = computeLiveRiskLevel(snapshot)
    if (riskLevel === "high" || snapshot.riskFlags.length >= 3) {
      highRiskCalls.push({
        sessionId: session.id,
        leadId: session.leadId,
        companyName: session.companyName,
        riskLevel,
        riskFlags: snapshot.riskFlags,
        executionScore: score.score,
        updatedAt: session.updatedAt,
      })
    }
  }

  for (const event of guidanceEvents) {
    const key = event.eventType
    const entry = guidanceEffectiveness.get(key) ?? { surfaced: 0, accepted: 0, title: event.title }
    entry.surfaced += 1
    if (event.acceptedAt) entry.accepted += 1
    guidanceEffectiveness.set(key, entry)
  }

  const avgExecutionScore =
    executionScores.length > 0
      ? Math.round(executionScores.reduce((sum, value) => sum + value, 0) / executionScores.length)
      : 0

  const buyingSignalCapturePercent =
    buyingSignalSessions.total > 0
      ? Math.round((buyingSignalSessions.withSignals / buyingSignalSessions.total) * 100)
      : 0

  const discoveryCompletionPercent =
    discoveryCompletionScores.length > 0
      ? Math.round(
          discoveryCompletionScores.reduce((sum, value) => sum + value, 0) / discoveryCompletionScores.length,
        )
      : 0

  const guidanceLatencies = completedSessions
    .map((session) => session.guidanceLatencyMs)
    .filter((value) => value > 0)
  const averageGuidanceLatencyMs =
    guidanceLatencies.length > 0
      ? Math.round(guidanceLatencies.reduce((sum, value) => sum + value, 0) / guidanceLatencies.length)
      : 0
  const p95GuidanceLatencyMs =
    guidanceLatencies.length > 0
      ? [...guidanceLatencies].sort((a, b) => a - b)[Math.floor(guidanceLatencies.length * 0.95)] ?? 0
      : 0

  return {
    stats: {
      completedSessions: completedSessions.length,
      averageExecutionScore: avgExecutionScore,
      buyingSignalCapturePercent,
      discoveryCompletionPercent,
      activeGuidanceEvents: guidanceEvents.filter((event) => !event.dismissedAt && !event.acceptedAt).length,
      averageGuidanceLatencyMs,
      p95GuidanceLatencyMs,
    },
    topObjections: [...objectionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => ({ key, count })),
    talkRatioDistribution: talkRatioBuckets,
    mostEffectiveGuidance: [...guidanceEffectiveness.entries()]
      .map(([eventType, stats]) => ({
        eventType,
        title: stats.title,
        surfaced: stats.surfaced,
        accepted: stats.accepted,
        acceptanceRate: stats.surfaced > 0 ? Math.round((stats.accepted / stats.surfaced) * 100) : 0,
      }))
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate || b.accepted - a.accepted)
      .slice(0, 8),
    operatorLeaderboard: [...operatorStats.entries()]
      .map(([operatorId, stats]) => ({
        operatorId,
        sessions: stats.sessions,
        acceptedGuidance: stats.acceptedGuidance,
        averageExecutionScore: stats.sessions > 0 ? Math.round(stats.totalScore / stats.sessions) : 0,
      }))
      .sort((a, b) => b.averageExecutionScore - a.averageExecutionScore || b.acceptedGuidance - a.acceptedGuidance)
      .slice(0, 10),
    highRiskCalls: highRiskCalls.slice(0, 12),
  }
}
