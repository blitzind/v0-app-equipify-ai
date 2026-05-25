import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emitMeetingOutcomeMissingNotification,
  emitMeetingRequestedNotification,
  emitMeetingStartingSoonNotification,
  emitPostMeetingFollowupDueNotification,
  growthMeetingScheduleHref,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-notifications"
import { emitMeetingFollowupDueTimeline } from "@/lib/growth/meeting-intelligence/meeting-intelligence-timeline-emitter"
import { listGrowthMeetingsForDashboardScan } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { proposeGrowthMeetingFromReply } from "@/lib/growth/meeting-intelligence/mutate-meeting"

const STARTING_SOON_MS = 30 * 60 * 1000
const OUTCOME_MISSING_GRACE_MS = 2 * 60 * 60 * 1000

export async function processReplyMeetingIntelligence(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    companyName: string
    ownerUserId: string | null
  },
): Promise<void> {
  const meeting = await proposeGrowthMeetingFromReply(admin, input)
  if (!meeting) return

  await emitMeetingRequestedNotification(admin, {
    leadId: input.leadId,
    meetingId: meeting.id,
    ownerUserId: input.ownerUserId,
    companyName: input.companyName,
    replyId: input.replyId,
  })
}

export async function evaluateGrowthMeetingIntelligenceNotifications(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null },
): Promise<void> {
  const now = Date.now()
  const meetings = await listGrowthMeetingsForDashboardScan(admin, input)

  for (const meeting of meetings) {
    const lead = await fetchGrowthLeadById(admin, meeting.leadId)
    const companyName = lead?.companyName ?? "Lead"
    const ownerUserId = meeting.ownerUserId ?? lead?.assignedTo ?? null

    if (meeting.status === "scheduled" && meeting.startAt) {
      const startMs = Date.parse(meeting.startAt)
      const delta = startMs - now
      if (delta > 0 && delta <= STARTING_SOON_MS) {
        await emitMeetingStartingSoonNotification(admin, {
          leadId: meeting.leadId,
          meetingId: meeting.id,
          ownerUserId,
          companyName,
          startAt: meeting.startAt,
        })
      }
    }

    if (meeting.status === "completed" && !meeting.outcome && meeting.completedAt) {
      const completedMs = Date.parse(meeting.completedAt)
      if (now - completedMs >= OUTCOME_MISSING_GRACE_MS) {
        await emitMeetingOutcomeMissingNotification(admin, {
          leadId: meeting.leadId,
          meetingId: meeting.id,
          ownerUserId,
          companyName,
        })
      }
    }

    if (
      meeting.status === "completed" &&
      meeting.followUpDueAt &&
      Date.parse(meeting.followUpDueAt) <= now
    ) {
      await emitPostMeetingFollowupDueNotification(admin, {
        leadId: meeting.leadId,
        meetingId: meeting.id,
        ownerUserId,
        companyName,
        followUpDueAt: meeting.followUpDueAt,
      })
      await emitMeetingFollowupDueTimeline(admin, { meeting })
    }
  }
}

export { growthMeetingScheduleHref }
