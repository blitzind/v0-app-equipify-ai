import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import {
  emitMeetingCanceledTimeline,
  emitMeetingCompletedTimeline,
  emitMeetingCreatedTimeline,
  emitMeetingNoShowTimeline,
  emitMeetingOutcomeRecordedTimeline,
  emitMeetingScheduledTimeline,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-timeline-emitter"
import {
  emitMeetingNoShowNotification,
  emitMeetingScheduledNotification,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-notifications"
import { generateCallIntelligenceScorecard } from "@/lib/growth/call-intelligence/call-intelligence-service"
import {
  fetchGrowthMeetingById,
  fetchGrowthMeetingByReplyId,
  insertGrowthMeetingRow,
  updateGrowthMeetingRow,
} from "@/lib/growth/meeting-intelligence/meeting-repository"
import type {
  CreateGrowthMeetingInput,
  GrowthMeeting,
  GrowthMeetingProvider,
  UpdateGrowthMeetingInput,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { recomputeGrowthLeadNextBestAction } from "@/lib/growth/recompute-lead-next-best-action"
import { recomputeMeetingOutcomeForMeeting } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-service"
import { maybeGenerateOpportunityDraftForMeeting } from "@/lib/growth/meeting-intelligence/opportunity-draft-service"
import { fetchGrowthMeetingLocationPlatformContext } from "@/lib/growth/meeting-location/meeting-location-settings-server"
import {
  applyResolvedMeetingLocationPatch,
  resolveMeetingLocation,
} from "@/lib/growth/meeting-location/resolve-meeting-location"
import type { GrowthMeetingLocationProvider } from "@/lib/growth/meeting-location/meeting-location-provider-types"

type Actor = { userId?: string | null; email?: string | null }

export type MutateGrowthMeetingResult =
  | { ok: true; meeting: GrowthMeeting }
  | { ok: false; code: string; message: string }

async function resolveOwnerUserId(
  admin: SupabaseClient,
  leadId: string,
  ownerUserId?: string | null,
): Promise<string | null> {
  if (ownerUserId) return ownerUserId
  const lead = await fetchGrowthLeadById(admin, leadId)
  return lead?.assignedTo ?? null
}

async function resolveOpportunityId(
  admin: SupabaseClient,
  leadId: string,
  opportunityId?: string | null,
): Promise<string | null> {
  if (opportunityId) return opportunityId
  const opportunity = await fetchGrowthOpportunityByLeadId(admin, leadId)
  return opportunity?.id ?? null
}

function providerToLocationType(provider: GrowthMeetingProvider | null | undefined): GrowthMeetingLocationProvider | null {
  if (!provider) return "no_auto_link"
  if (provider === "google_meet") return "google_meet"
  if (provider === "zoom") return "zoom"
  if (provider === "teams") return "teams"
  if (provider === "phone") return "phone_call"
  return "custom_location"
}

async function buildMeetingLocationPatch(
  admin: SupabaseClient,
  actorUserId: string | null | undefined,
  input: {
    meetingLocationType?: GrowthMeetingLocationProvider | null
    autoCreateMeetingLink?: boolean | null
    manualMeetingUrl?: string | null
    meetingLocationLabel?: string | null
    meetingUrl?: string | null
    provider?: GrowthMeetingProvider | null
  },
): Promise<Record<string, unknown>> {
  const platformContext = await fetchGrowthMeetingLocationPlatformContext(admin, actorUserId ?? "")
  const resolved = resolveMeetingLocation({
    platform: platformContext.settings,
    googleCalendarConnected: platformContext.googleCalendarConnected,
    meetingLocationType:
      input.meetingLocationType ?? providerToLocationType(input.provider) ?? platformContext.settings.defaultMeetingProvider,
    meetingAutoCreate: input.autoCreateMeetingLink,
    manualMeetingUrl: input.manualMeetingUrl,
    meetingLocationLabel: input.meetingLocationLabel,
    existingMeetingUrl: input.meetingUrl ?? null,
  })
  return applyResolvedMeetingLocationPatch(resolved)
}

export async function createGrowthMeeting(
  admin: SupabaseClient,
  input: CreateGrowthMeetingInput & { actor?: Actor },
): Promise<MutateGrowthMeetingResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, code: "lead_not_found", message: "Lead not found." }

  const ownerUserId = await resolveOwnerUserId(admin, input.leadId, input.ownerUserId)
  const opportunityId = await resolveOpportunityId(admin, input.leadId, input.opportunityId)
  const status = input.status ?? "proposed"
  const now = new Date().toISOString()
  const locationPatch = await buildMeetingLocationPatch(admin, ownerUserId ?? input.actor?.userId, input)

  const meeting = await insertGrowthMeetingRow(admin, {
    lead_id: input.leadId,
    owner_user_id: ownerUserId,
    opportunity_id: opportunityId,
    outbound_reply_id: input.outboundReplyId ?? null,
    realtime_call_session_id: input.realtimeCallSessionId ?? null,
    title: input.title.trim(),
    status,
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
    source: input.source ?? "manual",
    notes: input.notes ?? null,
    attendee_emails: input.attendeeEmails ?? [],
    timezone: input.timezone ?? "UTC",
    outcome: input.outcome ?? null,
    next_action: input.nextAction ?? null,
    follow_up_due_at: input.followUpDueAt ?? null,
    created_by: input.actor?.userId ?? null,
    scheduled_at: status === "scheduled" ? now : null,
    completed_at: status === "completed" ? now : null,
    ...locationPatch,
  })

  await emitMeetingCreatedTimeline(admin, {
    meeting,
    actorUserId: input.actor?.userId ?? null,
    outboundReplyId: input.outboundReplyId ?? null,
  })

  if (status === "scheduled") {
    await emitMeetingScheduledTimeline(admin, { meeting, actorUserId: input.actor?.userId ?? null })
    await emitMeetingScheduledNotification(admin, {
      leadId: meeting.leadId,
      meetingId: meeting.id,
      ownerUserId,
      companyName: lead.companyName,
      startAt: meeting.startAt,
    })
    await recomputeGrowthLeadNextBestAction(admin, input.leadId)
  }

  return { ok: true, meeting }
}

export async function updateGrowthMeeting(
  admin: SupabaseClient,
  meetingId: string,
  input: UpdateGrowthMeetingInput & { actor?: Actor },
): Promise<MutateGrowthMeetingResult> {
  const existing = await fetchGrowthMeetingById(admin, meetingId)
  if (!existing) return { ok: false, code: "not_found", message: "Meeting not found." }

  const lead = await fetchGrowthLeadById(admin, existing.leadId)
  if (!lead) return { ok: false, code: "lead_not_found", message: "Lead not found." }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {}
  if (input.title != null) patch.title = input.title.trim()
  if (input.startAt !== undefined) patch.start_at = input.startAt
  if (input.endAt !== undefined) patch.end_at = input.endAt
  if (input.provider !== undefined) patch.provider = input.provider
  if (input.calendarEventId !== undefined) patch.calendar_event_id = input.calendarEventId
  if (input.meetingUrl !== undefined) patch.meeting_url = input.meetingUrl
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.attendeeEmails !== undefined) patch.attendee_emails = input.attendeeEmails
  if (input.timezone !== undefined) patch.timezone = input.timezone ?? "UTC"
  if (input.ownerUserId !== undefined) patch.owner_user_id = input.ownerUserId
  if (input.opportunityId !== undefined) patch.opportunity_id = input.opportunityId
  if (input.outcome !== undefined) patch.outcome = input.outcome?.trim() || null
  if (input.nextAction !== undefined) patch.next_action = input.nextAction?.trim() || null
  if (input.followUpDueAt !== undefined) patch.follow_up_due_at = input.followUpDueAt
  if (input.noShowReason !== undefined) patch.no_show_reason = input.noShowReason?.trim() || null
  if (input.realtimeCallSessionId !== undefined) patch.realtime_call_session_id = input.realtimeCallSessionId

  const locationFieldsTouched =
    input.meetingLocationType !== undefined ||
    input.autoCreateMeetingLink !== undefined ||
    input.manualMeetingUrl !== undefined ||
    input.meetingLocationLabel !== undefined ||
    input.meetingUrl !== undefined ||
    input.provider !== undefined

  if (locationFieldsTouched) {
    Object.assign(
      patch,
      await buildMeetingLocationPatch(admin, existing.ownerUserId ?? input.actor?.userId, {
        meetingLocationType: input.meetingLocationType ?? existing.meetingLocationType,
        autoCreateMeetingLink: input.autoCreateMeetingLink ?? existing.autoCreateMeetingLink,
        manualMeetingUrl: input.manualMeetingUrl ?? existing.manualMeetingUrl,
        meetingLocationLabel: input.meetingLocationLabel ?? existing.meetingLocationLabel,
        meetingUrl: input.meetingUrl ?? existing.meetingUrl,
        provider: input.provider ?? existing.provider,
      }),
    )
  }

  const nextStatus = input.status ?? existing.status
  if (input.status && input.status !== existing.status) {
    patch.status = input.status
    if (input.status === "scheduled") patch.scheduled_at = now
    if (input.status === "completed") patch.completed_at = now
    if (input.status === "canceled") patch.canceled_at = now
    if (input.status === "no_show") patch.no_show_at = now
  }

  if (input.outcome && !existing.outcomeRecordedAt) {
    patch.outcome_recorded_at = now
  }

  const meeting = await updateGrowthMeetingRow(admin, meetingId, patch)
  const ownerUserId = meeting.ownerUserId ?? lead.assignedTo ?? null

  if (input.status === "scheduled" && existing.status !== "scheduled") {
    await emitMeetingScheduledTimeline(admin, { meeting, actorUserId: input.actor?.userId ?? null })
    await emitMeetingScheduledNotification(admin, {
      leadId: meeting.leadId,
      meetingId: meeting.id,
      ownerUserId,
      companyName: lead.companyName,
      startAt: meeting.startAt,
    })
    await recomputeGrowthLeadNextBestAction(admin, meeting.leadId)
  }

  if (input.status === "completed" && existing.status !== "completed") {
    await emitMeetingCompletedTimeline(admin, {
      meeting,
      actorUserId: input.actor?.userId ?? null,
      sessionId: meeting.realtimeCallSessionId,
    })
  }

  if (input.status === "no_show" && existing.status !== "no_show") {
    await emitMeetingNoShowTimeline(admin, {
      meeting,
      actorUserId: input.actor?.userId ?? null,
      reason: meeting.noShowReason,
    })
    await emitMeetingNoShowNotification(admin, {
      leadId: meeting.leadId,
      meetingId: meeting.id,
      ownerUserId,
      companyName: lead.companyName,
      reason: meeting.noShowReason,
    })
  }

  if (input.status === "canceled" && existing.status !== "canceled") {
    await emitMeetingCanceledTimeline(admin, { meeting, actorUserId: input.actor?.userId ?? null })
  }

  if (input.outcome && input.outcome.trim()) {
    const suggestStageAdvance = Boolean(meeting.opportunityId && nextStatus === "completed")
    await emitMeetingOutcomeRecordedTimeline(admin, {
      meeting,
      actorUserId: input.actor?.userId ?? null,
      suggestStageAdvance,
      sessionId: meeting.realtimeCallSessionId,
    })

    void generateCallIntelligenceScorecard({
      admin,
      leadId: meeting.leadId,
      meetingId: meeting.id,
      realtimeSessionId: meeting.realtimeCallSessionId,
      trigger: "meeting_outcome",
    }).catch(() => undefined)
  }

  const shouldRecomputeMeetingOutcome =
    Boolean(input.outcome?.trim()) ||
    (input.status === "completed" && existing.status !== "completed") ||
    (input.status === "no_show" && existing.status !== "no_show")

  const meetingJustCompleted = input.status === "completed" && existing.status !== "completed"
  const outcomeJustSubmitted = Boolean(input.outcome?.trim()) && !existing.outcomeRecordedAt

  if (shouldRecomputeMeetingOutcome) {
    void recomputeMeetingOutcomeForMeeting(admin, meetingId)
      .then(() => {
        if (nextStatus === "completed") {
          return maybeGenerateOpportunityDraftForMeeting(admin, meetingId, {
            regenerate: outcomeJustSubmitted && !meetingJustCompleted,
            trigger: outcomeJustSubmitted ? "meeting_outcome" : "meeting_completed",
            actor_user_id: input.actor?.userId ?? null,
            actor_email: input.actor?.email ?? null,
          })
        }
        return undefined
      })
      .catch(() => undefined)
  } else if (nextStatus === "completed" && (meetingJustCompleted || outcomeJustSubmitted)) {
    void maybeGenerateOpportunityDraftForMeeting(admin, meetingId, {
      regenerate: outcomeJustSubmitted && !meetingJustCompleted,
      trigger: outcomeJustSubmitted ? "meeting_outcome" : "meeting_completed",
      actor_user_id: input.actor?.userId ?? null,
      actor_email: input.actor?.email ?? null,
    }).catch(() => undefined)
  }

  if (
    (input.status === "completed" || input.status === "no_show") &&
    input.status !== existing.status &&
    meeting.realtimeCallSessionId
  ) {
    void generateCallIntelligenceScorecard({
      admin,
      leadId: meeting.leadId,
      meetingId: meeting.id,
      realtimeSessionId: meeting.realtimeCallSessionId,
      trigger: "meeting_outcome",
    }).catch(() => undefined)
  }

  return { ok: true, meeting }
}

export async function proposeGrowthMeetingFromReply(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    companyName: string
    ownerUserId: string | null
  },
): Promise<GrowthMeeting | null> {
  const existing = await fetchGrowthMeetingByReplyId(admin, input.replyId)
  if (existing) return existing

  const result = await createGrowthMeeting(admin, {
    leadId: input.leadId,
    outboundReplyId: input.replyId,
    title: `Meeting with ${input.companyName}`,
    status: "proposed",
    source: "reply_intent",
    ownerUserId: input.ownerUserId,
  })

  return result.ok ? result.meeting : null
}
