import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type {
  GrowthReplyIntent,
  GrowthReplyNextAction,
  GrowthReplyPriority,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

export async function emitReplyReceivedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; replyId: string; intent: GrowthReplyIntent; priority: GrowthReplyPriority },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "reply_received",
    title: "Reply received",
    summary: `Inbound reply classified as ${input.intent.replace(/_/g, " ")} (${input.priority} priority).`,
    outboundReplyId: input.replyId,
    payload: { intent: input.intent, priority: input.priority },
  })

  const { recordReplyAttributionTouchForLead } = await import(
    "@/lib/growth/revenue-attribution/record-reply-attribution-touch"
  )
  await recordReplyAttributionTouchForLead(admin, {
    leadId: input.leadId,
    replyId: input.replyId,
    attributionSource: "reply_received_timeline",
    metadata: { intent: input.intent, priority: input.priority },
  }).catch(() => undefined)
}

export async function emitReplyClassifiedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    intent: GrowthReplyIntent
    priority: GrowthReplyPriority
    nextAction: GrowthReplyNextAction
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "reply_classified",
    title: "Reply classified",
    summary: `Next action: ${input.nextAction.replace(/_/g, " ")}.`,
    outboundReplyId: input.replyId,
    payload: {
      intent: input.intent,
      priority: input.priority,
      nextAction: input.nextAction,
    },
  })
}

export async function emitReplyAssignedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; replyId: string; ownerUserId: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "reply_assigned",
    title: input.ownerUserId ? "Reply routed to owner" : "Reply awaiting owner",
    summary: input.ownerUserId ? "Reply inherited lead ownership." : "Unassigned reply needs attention.",
    outboundReplyId: input.replyId,
    payload: { ownerUserId: input.ownerUserId },
  })
}

export async function emitMeetingRequestedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; replyId: string },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "meeting_requested",
    title: "Meeting requested",
    summary: "Prospect requested a meeting from inbound reply.",
    outboundReplyId: input.replyId,
    payload: {},
  })
}

export async function emitReplyCompetitorDetectedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; replyId: string },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "competitor_detected",
    title: "Competitor mentioned in reply",
    summary: "Competitive pressure detected in inbound reply.",
    outboundReplyId: input.replyId,
    payload: {},
  })
}

export async function emitReplyFollowupCreatedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; replyId: string; nextAction: GrowthReplyNextAction },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "follow_up_created",
    title: "Reply follow-up created",
    summary: `Suggested action: ${input.nextAction.replace(/_/g, " ")}.`,
    outboundReplyId: input.replyId,
    payload: { nextAction: input.nextAction },
  })
}
