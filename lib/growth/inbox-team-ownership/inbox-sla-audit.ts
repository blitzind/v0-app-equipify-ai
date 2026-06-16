import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationInboxEvent } from "@/lib/growth/notifications/growth-notification-events"
import { GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER } from "@/lib/growth/notifications/growth-inbox-notification-content"
import { createReplyIntelligenceEvent } from "@/lib/growth/inbox/reply-events"
import { recordInboxOwnershipPlatformTimeline } from "@/lib/growth/inbox-team-ownership/inbox-ownership-events"

export async function recordInboxThreadSlaAudit(
  admin: SupabaseClient,
  input: {
    threadId: string
    leadId: string | null
    event: GrowthOperatorNotificationInboxEvent
    slaDueAt: string
    occurredAt?: string
  },
): Promise<void> {
  const isOverdue = input.event === "thread_sla_overdue"
  const title = isOverdue ? "Reply SLA overdue" : "Reply SLA approaching"
  const description = isOverdue
    ? "Conversation requires immediate attention."
    : "Conversation needs attention soon."

  const metadata = {
    qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
    sla_due_at: input.slaDueAt,
    lead_id: input.leadId,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  }

  await createReplyIntelligenceEvent(admin, {
    thread_id: input.threadId,
    event_type: input.event,
    severity: isOverdue ? "critical" : "high",
    title,
    description,
    metadata,
  })

  if (isOverdue) {
    await recordInboxOwnershipPlatformTimeline(admin, {
      eventType: "thread_sla_overdue",
      title,
      summary: description,
      leadId: input.leadId,
      threadId: input.threadId,
      payload: metadata,
    })
  }
}
