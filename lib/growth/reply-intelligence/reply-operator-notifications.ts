import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationReplyEvent } from "@/lib/growth/notifications/growth-notification-events"
import {
  buildGrowthReplyOperatorNotificationContent,
  resolveReplyIntentLabel,
} from "@/lib/growth/notifications/growth-reply-notification-content"
import {
  createGrowthNotification,
  createGrowthNotificationsForEvent,
} from "@/lib/growth/notifications/growth-notification-service"
import {
  resolveGrowthOperatorNotificationRecipients,
  type GrowthOperatorNotificationRoutingContext,
} from "@/lib/growth/notifications/growth-notification-routing"
import type { GrowthReplyIntent, GrowthReplyPriority } from "@/lib/growth/reply-intelligence/reply-intent-types"

const POSITIVE_INTEREST_INTENTS = new Set<GrowthReplyIntent>([
  "positive_interest",
  "pricing_question",
  "referral",
  "needs_more_information",
])

const MEETING_INTENTS = new Set<GrowthReplyIntent>(["meeting_request", "demo_request"])

export async function resolveInboxOwnerUserIdForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ inboxOwnerUserId: string | null; inboxThreadId: string | null }> {
  const { data, error } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id, owner_user_id")
    .eq("lead_id", leadId)
    .neq("thread_status", "archived")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return { inboxOwnerUserId: null, inboxThreadId: null }
  }

  const row = data as { id?: string; owner_user_id?: string | null }
  return {
    inboxOwnerUserId: typeof row.owner_user_id === "string" ? row.owner_user_id : null,
    inboxThreadId: typeof row.id === "string" ? row.id : null,
  }
}

export function buildReplyOperatorNotificationRoutingContext(input: {
  leadOwnerUserId?: string | null
  inboxOwnerUserId?: string | null
}): GrowthOperatorNotificationRoutingContext {
  return {
    leadOwnerUserId: input.leadOwnerUserId ?? null,
    inboxOwnerUserId: input.inboxOwnerUserId ?? null,
    campaignOwnerUserId: null,
  }
}

export function shouldEmitReplyPositiveInterestOperatorNotification(input: {
  intent: GrowthReplyIntent
  buyingSignalCount: number
}): boolean {
  if (input.intent === "competitor_mention" || input.intent === "unsubscribe" || input.intent === "not_interested") {
    return false
  }
  if (POSITIVE_INTEREST_INTENTS.has(input.intent)) return true
  return input.buyingSignalCount > 0
}

export function resolveReplyOperatorNotificationEvents(input: {
  intent: GrowthReplyIntent
  buyingSignalCount: number
}): GrowthOperatorNotificationReplyEvent[] {
  const events: GrowthOperatorNotificationReplyEvent[] = ["reply_received"]

  if (shouldEmitReplyPositiveInterestOperatorNotification(input)) {
    events.push("reply_positive_interest")
  }
  if (MEETING_INTENTS.has(input.intent)) {
    events.push("reply_meeting_requested")
  }
  if (input.intent === "competitor_mention") {
    events.push("reply_competitor_detected")
  }

  return events
}

export function shouldUsePlatformAdminReplyFallback(input: {
  event: GrowthOperatorNotificationReplyEvent
  leadOwnerUserId: string | null
  priority: GrowthReplyPriority
}): boolean {
  if (input.leadOwnerUserId) return false
  if (input.event === "reply_meeting_requested") return true
  return input.priority === "critical" || input.priority === "high"
}

export async function emitReplyOperatorNotificationForEvent(
  admin: SupabaseClient,
  input: {
    event: GrowthOperatorNotificationReplyEvent
    replyId: string
    leadId: string
    organizationId?: string | null
    companyLabel: string
    intent: GrowthReplyIntent
    priority: GrowthReplyPriority
    routingContext: GrowthOperatorNotificationRoutingContext
    inboxThreadId?: string | null
    receivedAt: string
  },
): Promise<void> {
  const content = buildGrowthReplyOperatorNotificationContent({
    event: input.event,
    companyLabel: input.companyLabel,
    intentLabel: input.event === "reply_received" ? resolveReplyIntentLabel(input.intent) : null,
  })

  const dedupe = {
    sourceSystem: "reply_intelligence",
    sourceId: input.replyId,
    leadId: input.leadId,
    threadId: input.inboxThreadId ?? null,
  }

  const payload = {
    qa_marker: "growth-reply-booking-notifications-sn4-v1",
    reply_id: input.replyId,
    lead_id: input.leadId,
    intent: input.intent,
    priority: input.priority,
    occurred_at: input.receivedAt,
    inbox_thread_id: input.inboxThreadId ?? null,
  }

  const hasAssignableOwner = Boolean(
    input.routingContext.leadOwnerUserId || input.routingContext.inboxOwnerUserId,
  )

  if (hasAssignableOwner || input.event === "reply_meeting_requested") {
    await createGrowthNotificationsForEvent(admin, {
      organizationId: input.organizationId,
      event: input.event,
      title: content.title,
      body: content.body,
      payload,
      targetEntityType: "reply",
      targetEntityId: input.replyId,
      routingContext: input.routingContext,
      dedupe,
    })
    return
  }

  if (
    shouldUsePlatformAdminReplyFallback({
      event: input.event,
      leadOwnerUserId: input.routingContext.leadOwnerUserId ?? null,
      priority: input.priority,
    })
  ) {
    await createGrowthNotification(admin, {
      organizationId: input.organizationId,
      event: input.event,
      title: content.title,
      body: content.body,
      payload,
      targetEntityType: "reply",
      targetEntityId: input.replyId,
      routingContext: input.routingContext,
      recipientRole: "platform_admin",
      recipientUserId: null,
      dedupe,
    })
  }
}

export async function emitReplyOperatorNotificationsFromIntelligence(
  admin: SupabaseClient,
  input: {
    replyId: string
    leadId: string
    organizationId?: string | null
    companyLabel: string
    intent: GrowthReplyIntent
    priority: GrowthReplyPriority
    leadOwnerUserId: string | null
    receivedAt: string
    buyingSignalCount: number
  },
): Promise<void> {
  const inbox = await resolveInboxOwnerUserIdForLead(admin, input.leadId)
  const routingContext = buildReplyOperatorNotificationRoutingContext({
    leadOwnerUserId: input.leadOwnerUserId,
    inboxOwnerUserId: inbox.inboxOwnerUserId,
  })

  const events = resolveReplyOperatorNotificationEvents({
    intent: input.intent,
    buyingSignalCount: input.buyingSignalCount,
  })

  for (const event of events) {
    await emitReplyOperatorNotificationForEvent(admin, {
      event,
      replyId: input.replyId,
      leadId: input.leadId,
      organizationId: input.organizationId,
      companyLabel: input.companyLabel,
      intent: input.intent,
      priority: input.priority,
      routingContext,
      inboxThreadId: inbox.inboxThreadId,
      receivedAt: input.receivedAt,
    })
  }
}

export function resolveReplyOperatorNotificationRecipientsForCert(
  event: GrowthOperatorNotificationReplyEvent,
  context: GrowthOperatorNotificationRoutingContext,
  priority: GrowthReplyPriority,
): ReturnType<typeof resolveGrowthOperatorNotificationRecipients> {
  const recipients = resolveGrowthOperatorNotificationRecipients(event, context).filter(
    (recipient) => recipient.role !== "platform_admin" || recipient.userId === null,
  )

  const hasLeadOwner = Boolean(context.leadOwnerUserId)
  const withUserIds = recipients.filter(
    (recipient) => recipient.role !== "platform_admin" && recipient.userId,
  )

  if (withUserIds.length > 0 || event === "reply_meeting_requested") {
    return recipients.filter(
      (recipient) =>
        recipient.userId ||
        recipient.role === "platform_admin" ||
        (recipient.role !== "platform_admin" && event === "reply_meeting_requested"),
    )
  }

  if (
    shouldUsePlatformAdminReplyFallback({
      event,
      leadOwnerUserId: context.leadOwnerUserId ?? null,
      priority,
    })
  ) {
    return [{ role: "platform_admin", userId: null }]
  }

  return withUserIds
}
