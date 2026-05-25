import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchLatestMeetingOutcomeScoreForLead,
  fetchMeetingOutcomeDashboard,
  listMeetingOutcomeScoresForLead,
  recomputeMeetingOutcomeForMeeting,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-repository"
import type {
  MeetingOutcomeDashboardSummary,
  MeetingOutcomeLeadView,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"

export async function fetchGrowthMeetingOutcomeDashboardView(
  admin: SupabaseClient,
): Promise<MeetingOutcomeDashboardSummary> {
  return fetchMeetingOutcomeDashboard(admin)
}

export async function fetchGrowthMeetingOutcomeLeadView(
  admin: SupabaseClient,
  leadId: string,
  companyName: string,
): Promise<MeetingOutcomeLeadView> {
  const [latestScore, meetingScores] = await Promise.all([
    fetchLatestMeetingOutcomeScoreForLead(admin, leadId),
    listMeetingOutcomeScoresForLead(admin, leadId, 8),
  ])
  return {
    qaMarker: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
    leadId,
    companyName,
    latestScore,
    meetingScores,
  }
}

export async function recomputeGrowthMeetingOutcomesForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("growth")
    .from("meetings")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["completed", "no_show", "scheduled"])
    .order("updated_at", { ascending: false })
    .limit(5)
  if (error) throw new Error(error.message)

  let count = 0
  for (const row of data ?? []) {
    const score = await recomputeMeetingOutcomeForMeeting(admin, row.id as string)
    if (score) count += 1
  }
  return count
}

export { recomputeMeetingOutcomeForMeeting }
