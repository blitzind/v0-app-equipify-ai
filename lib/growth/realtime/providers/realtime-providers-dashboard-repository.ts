import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listRealtimeProviderConnections,
  sanitizeRealtimeProviderConnectionForApi,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import { listRecentGrowthRealtimeCallSessions } from "@/lib/growth/realtime/realtime-call-repository"

export async function fetchGrowthRealtimeProvidersDashboard(admin: SupabaseClient) {
  const connections = await listRealtimeProviderConnections(admin)
  const recentSessions = await listRecentGrowthRealtimeCallSessions(admin, 80)
  const completed = recentSessions.filter((session) => session.status === "completed")

  const guidanceLatencies = completed
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

  const qualityScores = completed
    .map((session) => session.transcriptQualityScore)
    .filter((value) => value > 0)
  const averageTranscriptQualityScore =
    qualityScores.length > 0
      ? Math.round(qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length)
      : 0

  const totalFailovers = connections.reduce((sum, connection) => sum + connection.providerFailoverCount, 0)
  const totalDisconnects = connections.reduce((sum, connection) => sum + connection.providerDisconnectCount, 0)
  const totalRecoveryAttempts = connections.reduce(
    (sum, connection) => sum + connection.providerRecoveryAttemptCount,
    0,
  )
  const totalRecoverySuccesses = connections.reduce(
    (sum, connection) => sum + connection.providerRecoverySuccessCount,
    0,
  )
  const providerRecoverySuccessRate =
    totalRecoveryAttempts > 0 ? Math.round((totalRecoverySuccesses / totalRecoveryAttempts) * 100) : 0

  return {
    stats: {
      connectionCount: connections.length,
      connectedCount: connections.filter((connection) => connection.status === "connected").length,
      averageGuidanceLatencyMs,
      p95GuidanceLatencyMs,
      averageTranscriptQualityScore,
      providerFailoverCount: totalFailovers,
      providerDisconnectCount: totalDisconnects,
      providerRecoverySuccessRate,
    },
    connections: connections.map(sanitizeRealtimeProviderConnectionForApi),
    coachingResponsiveness: {
      averageGuidanceLatencyMs,
      p95GuidanceLatencyMs,
      sampleSize: guidanceLatencies.length,
      targetLatencyMs: 250,
    },
  }
}
