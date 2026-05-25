import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

function meetingPayload(meeting: Pick<GrowthMeeting, "id" | "status" | "title" | "startAt" | "source" | "provider">) {
  return {
    meetingId: meeting.id,
    status: meeting.status,
    title: meeting.title,
    startAt: meeting.startAt,
    source: meeting.source,
    provider: meeting.provider,
  }
}

export async function emitMeetingCreatedTimeline(
  admin: SupabaseClient,
  input: { meeting: GrowthMeeting; actorUserId?: string | null; outboundReplyId?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_created",
    title: "Meeting proposed",
    summary: `${input.meeting.title} — awaiting confirmation to schedule.`,
    actorUserId: input.actorUserId ?? null,
    outboundReplyId: input.outboundReplyId ?? input.meeting.outboundReplyId,
    payload: meetingPayload(input.meeting),
  })
}

export async function emitMeetingScheduledTimeline(
  admin: SupabaseClient,
  input: { meeting: GrowthMeeting; actorUserId?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_scheduled",
    title: "Meeting scheduled",
    summary: input.meeting.startAt
      ? `${input.meeting.title} scheduled for ${new Date(input.meeting.startAt).toLocaleString()}.`
      : `${input.meeting.title} marked scheduled.`,
    actorUserId: input.actorUserId ?? null,
    outboundReplyId: input.meeting.outboundReplyId,
    payload: meetingPayload(input.meeting),
  })
}

export async function emitMeetingCompletedTimeline(
  admin: SupabaseClient,
  input: { meeting: GrowthMeeting; actorUserId?: string | null; sessionId?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_completed",
    title: "Meeting completed",
    summary: input.meeting.outcome
      ? `${input.meeting.title} completed — outcome recorded.`
      : `${input.meeting.title} completed — outcome pending.`,
    actorUserId: input.actorUserId ?? null,
    outboundReplyId: input.meeting.outboundReplyId,
    payload: {
      ...meetingPayload(input.meeting),
      sessionId: input.sessionId ?? input.meeting.realtimeCallSessionId,
    },
  })
}

export async function emitMeetingNoShowTimeline(
  admin: SupabaseClient,
  input: { meeting: GrowthMeeting; actorUserId?: string | null; reason?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_no_show",
    title: "Meeting no-show",
    summary: input.reason
      ? `${input.meeting.title} marked no-show: ${input.reason}.`
      : `${input.meeting.title} marked no-show.`,
    actorUserId: input.actorUserId ?? null,
    outboundReplyId: input.meeting.outboundReplyId,
    payload: { ...meetingPayload(input.meeting), noShowReason: input.reason ?? null },
  })
}

export async function emitMeetingCanceledTimeline(
  admin: SupabaseClient,
  input: { meeting: GrowthMeeting; actorUserId?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_canceled",
    title: "Meeting canceled",
    summary: `${input.meeting.title} was canceled.`,
    actorUserId: input.actorUserId ?? null,
    outboundReplyId: input.meeting.outboundReplyId,
    payload: meetingPayload(input.meeting),
  })
}

export async function emitMeetingFollowupDueTimeline(
  admin: SupabaseClient,
  input: { meeting: GrowthMeeting },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_followup_due",
    title: "Meeting follow-up due",
    summary: `Follow-up due for ${input.meeting.title}.`,
    outboundReplyId: input.meeting.outboundReplyId,
    payload: meetingPayload(input.meeting),
  })
}

export async function emitMeetingOutcomeRecordedTimeline(
  admin: SupabaseClient,
  input: {
    meeting: GrowthMeeting
    actorUserId?: string | null
    suggestStageAdvance?: boolean
    sessionId?: string | null
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.meeting.leadId,
    eventType: "meeting_outcome_recorded",
    title: "Meeting outcome recorded",
    summary: input.suggestStageAdvance
      ? `${input.meeting.title} outcome saved — review opportunity stage (no auto-move).`
      : `${input.meeting.title} outcome saved.`,
    actorUserId: input.actorUserId ?? null,
    outboundReplyId: input.meeting.outboundReplyId,
    payload: {
      ...meetingPayload(input.meeting),
      outcome: input.meeting.outcome,
      nextAction: input.meeting.nextAction,
      suggestStageAdvance: input.suggestStageAdvance ?? false,
      sessionId: input.sessionId ?? input.meeting.realtimeCallSessionId,
    },
  })
}
