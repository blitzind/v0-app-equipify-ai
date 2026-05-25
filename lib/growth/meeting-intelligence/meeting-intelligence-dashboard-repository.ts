import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveGrowthCalendarSyncReadiness } from "@/lib/growth/meeting-intelligence/calendar-sync-readiness"
import {
  GROWTH_MEETING_INTELLIGENCE_QA_MARKER,
  type GrowthMeetingCommandSummary,
  type GrowthMeetingIntelligenceDashboard,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { listGrowthMeetingsForDashboardScan } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { evaluateGrowthMeetingIntelligenceNotifications } from "@/lib/growth/meeting-intelligence/process-meeting-intelligence"

const STARTING_SOON_MS = 30 * 60 * 1000

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayIso(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function aggregateMeetings(
  meetings: Awaited<ReturnType<typeof listGrowthMeetingsForDashboardScan>>,
  nowMs: number,
) {
  const nowIso = new Date(nowMs).toISOString()
  const todayStart = startOfTodayIso()
  const todayEnd = endOfTodayIso()

  return {
    upcomingCount: meetings.filter((m) => m.status === "scheduled" && m.startAt && m.startAt >= nowIso).length,
    meetingRequestCount: meetings.filter((m) => m.status === "proposed").length,
    outcomesMissingCount: meetings.filter((m) => m.status === "completed" && !m.outcome).length,
    noShowCount: meetings.filter((m) => m.status === "no_show").length,
    followUpsDueCount: meetings.filter(
      (m) => m.status === "completed" && m.followUpDueAt && m.followUpDueAt <= nowIso,
    ).length,
    startingSoonCount: meetings.filter((m) => {
      if (m.status !== "scheduled" || !m.startAt) return false
      const delta = Date.parse(m.startAt) - nowMs
      return delta > 0 && delta <= STARTING_SOON_MS
    }).length,
    completedTodayCount: meetings.filter(
      (m) => m.status === "completed" && m.completedAt && m.completedAt >= todayStart && m.completedAt <= todayEnd,
    ).length,
    meetingsTodayCount: meetings.filter(
      (m) => m.status === "scheduled" && m.startAt && m.startAt >= todayStart && m.startAt <= todayEnd,
    ).length,
  }
}

export async function fetchGrowthMeetingIntelligenceDashboard(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null },
): Promise<GrowthMeetingIntelligenceDashboard> {
  await evaluateGrowthMeetingIntelligenceNotifications(admin, input)
  const calendar = resolveGrowthCalendarSyncReadiness()
  const meetings = await listGrowthMeetingsForDashboardScan(admin, input)
  const stats = aggregateMeetings(meetings, Date.now())

  return {
    qaMarker: GROWTH_MEETING_INTELLIGENCE_QA_MARKER,
    calendarSyncReady: calendar.ready,
    calendarSetupMessage: calendar.setupMessage,
    ...stats,
  }
}

export async function fetchGrowthMeetingCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthMeetingCommandSummary> {
  await evaluateGrowthMeetingIntelligenceNotifications(admin)
  const meetings = await listGrowthMeetingsForDashboardScan(admin)
  const stats = aggregateMeetings(meetings, Date.now())

  return {
    qaMarker: GROWTH_MEETING_INTELLIGENCE_QA_MARKER,
    meetingsTodayCount: stats.meetingsTodayCount,
    noShowCount: stats.noShowCount,
    outcomesMissingCount: stats.outcomesMissingCount,
    followUpsDueCount: stats.followUpsDueCount,
  }
}
