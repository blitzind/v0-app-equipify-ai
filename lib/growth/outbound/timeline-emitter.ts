import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import type { CanonicalOutboundEventType, NormalizedOutboundEvent } from "@/lib/growth/outbound/types"
import type { GrowthOutboundReplyClassification } from "@/lib/growth/outbound/types"

const EVENT_TO_TIMELINE: Record<CanonicalOutboundEventType, GrowthLeadTimelineEventType> = {
  sent: "email_sent",
  delivered: "email_delivered",
  opened: "email_opened",
  clicked: "email_clicked",
  replied: "email_replied",
  bounced: "email_bounced",
  unsubscribed: "email_unsubscribed",
  failed: "email_failed",
  spam_complaint: "email_spam_complaint",
}

const EVENT_TITLES: Record<GrowthLeadTimelineEventType, string> = {
  lead_created: "Lead created",
  research_started: "Research started",
  research_completed: "Research completed",
  research_failed: "Research failed",
  website_fetch_failed: "Website fetch failed",
  website_fetch_fixed: "Website fetch fixed",
  decision_maker_added: "Decision maker added",
  decision_maker_confirmed: "Decision maker confirmed",
  decision_maker_rejected: "Decision maker rejected",
  call_attempted: "Call attempted",
  voicemail_left: "Voicemail left",
  interested: "Interested",
  follow_up_created: "Follow-up created",
  follow_up_completed: "Follow-up completed",
  notes_updated: "Notes updated",
  priority_changed: "Priority changed",
  override_changed: "Override changed",
  next_best_action_changed: "Next best action changed",
  website_changed: "Website changed",
  status_changed: "Status changed",
  import_created: "Import created",
  import_updated: "Import updated",
  manual_touch: "Manual touch",
  email_sent: "Email sent",
  email_delivered: "Email delivered",
  email_opened: "Email opened",
  email_clicked: "Email clicked",
  email_replied: "Email reply received",
  email_bounced: "Email bounced",
  email_unsubscribed: "Email unsubscribed",
  email_failed: "Email failed",
  email_spam_complaint: "Spam complaint",
  email_suppressed: "Email suppressed",
  email_unmatched: "Unmatched email event",
}

export async function emitGrowthLeadEmailEventTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    event: NormalizedOutboundEvent
    messageEventId: string
    outboundMessageId?: string | null
    outboundReplyId?: string | null
    campaignName?: string | null
    classification?: GrowthOutboundReplyClassification
  },
) {
  const eventType = EVENT_TO_TIMELINE[input.event.eventType]
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType,
    title: EVENT_TITLES[eventType],
    summary: input.event.subject ?? input.event.bodyPreview ?? input.event.eventType,
    occurredAt: input.event.occurredAt,
    payload: {
      provider: input.event.provider,
      eventType: input.event.eventType,
      email: input.event.email,
      campaignName: input.campaignName,
      subject: input.event.subject,
      bodyPreview: input.event.bodyPreview,
      classification: input.classification,
    },
    messageEventId: input.messageEventId,
    outboundMessageId: input.outboundMessageId ?? null,
    outboundReplyId: input.outboundReplyId ?? null,
  })
}

export async function emitGrowthLeadEmailSuppressedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    email: string
    reason: string
    messageEventId: string
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "email_suppressed",
    title: EVENT_TITLES.email_suppressed,
    summary: `${input.email} · ${input.reason.replace(/_/g, " ")}`,
    payload: { email: input.email, reason: input.reason },
    messageEventId: input.messageEventId,
  })
}

export async function emitGrowthLeadEmailUnmatchedTimeline(
  admin: SupabaseClient,
  input: { email: string; providerEventId: string; webhookId: string },
) {
  // Orphan events without lead_id cannot be stored on lead timeline in 5.1A.
  void input
}
