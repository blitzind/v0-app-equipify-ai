import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchActiveNativeCallSession,
  listNativeDialerQueue,
  listRecentNativeCallSessions,
  resolveNativeDialerProviders,
} from "@/lib/growth/native-dialer/native-dialer-repository"
import type { NativeCallWorkspaceDashboard } from "@/lib/growth/native-dialer/native-dialer-types"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function fetchNativeCallWorkspaceDashboard(
  admin: SupabaseClient,
  ownerUserId?: string | null,
): Promise<NativeCallWorkspaceDashboard> {
  const today = startOfTodayIso()
  const [providers, activeSession, recentSessions, queuePreview, sessionsRes, wrapupsRes, queueCompletedRes] =
    await Promise.all([
      resolveNativeDialerProviders(admin),
      fetchActiveNativeCallSession(admin, ownerUserId),
      listRecentNativeCallSessions(admin, 8),
      listNativeDialerQueue(admin, { limit: 10 }),
      admin
        .schema("growth")
        .from("native_call_workspace_sessions")
        .select("status, duration_seconds, connected_at")
        .gte("started_at", today),
      admin
        .schema("growth")
        .from("native_call_wrapups")
        .select("outcome, meeting_booked, follow_up_needed, objection_category, connected")
        .gte("created_at", today),
      admin
        .schema("growth")
        .from("native_dialer_queue_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", today),
    ])

  const sessions = sessionsRes.data ?? []
  const wrapups = wrapupsRes.data ?? []
  const callsToday = sessions.length
  const connectedCount = wrapups.filter((row) => row.connected === true).length
  const meetingCount = wrapups.filter((row) => row.meeting_booked === true).length
  const followUpCompleted = wrapups.filter(
    (row) => row.follow_up_needed === true && row.outcome !== "no_answer",
  ).length
  const followUpNeeded = wrapups.filter((row) => row.follow_up_needed === true).length
  const durations = sessions
    .map((row) => row.duration_seconds as number)
    .filter((value) => value > 0)
  const avgTalkTimeSeconds =
    durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0
  const objectionTrendCount = wrapups.filter((row) => Boolean(row.objection_category)).length
  const qualityScores = await admin
    .schema("growth")
    .from("call_intelligence_scorecards")
    .select("overall_score")
    .gte("computed_at", today)
    .limit(50)
  const callQualityTrend =
    qualityScores.data && qualityScores.data.length > 0
      ? Math.round(
          qualityScores.data.reduce((sum, row) => sum + (row.overall_score as number), 0) /
            qualityScores.data.length,
        )
      : 0

  return {
    qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
    generatedAt: new Date().toISOString(),
    metrics: {
      callsToday,
      connectionRate: callsToday > 0 ? Math.round((connectedCount / callsToday) * 100) : 0,
      meetingRate: connectedCount > 0 ? Math.round((meetingCount / connectedCount) * 100) : 0,
      avgTalkTimeSeconds,
      objectionTrendCount,
      callQualityTrend,
      meetingConversionRate: connectedCount > 0 ? Math.round((meetingCount / connectedCount) * 100) : 0,
      followUpCompletionRate:
        followUpNeeded > 0 ? Math.round((followUpCompleted / followUpNeeded) * 100) : 100,
      queueThroughput: queueCompletedRes.count ?? 0,
    },
    activeSession,
    recentSessions,
    queuePreview,
    primaryProvider: providers.primaryProvider,
    fallbackProvider: providers.fallbackProvider,
  }
}
