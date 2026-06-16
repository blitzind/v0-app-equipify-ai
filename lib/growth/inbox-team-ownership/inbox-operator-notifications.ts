import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationInboxEvent } from "@/lib/growth/notifications/growth-notification-events"
import {
  buildGrowthInboxOperatorNotificationContent,
  GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "@/lib/growth/notifications/growth-inbox-notification-content"
import {
  createGrowthNotification,
} from "@/lib/growth/notifications/growth-notification-service"
import type {
  GrowthOperatorNotificationRecipient,
  GrowthOperatorNotificationRoutingContext,
} from "@/lib/growth/notifications/growth-notification-routing"

export function buildInboxThreadSlaOperatorNotificationDedupeSourceId(input: {
  threadId: string
  event: GrowthOperatorNotificationInboxEvent
}): string {
  return `${input.threadId}:${input.event}`
}

export function shouldUseInboxSlaPlatformAdminFallback(
  event: GrowthOperatorNotificationInboxEvent,
  routingContext: GrowthOperatorNotificationRoutingContext,
): boolean {
  if (event !== "thread_sla_overdue") return false
  return !routingContext.inboxOwnerUserId && !routingContext.leadOwnerUserId
}

export function resolveInboxThreadSlaOperatorRecipients(
  event: GrowthOperatorNotificationInboxEvent,
  routingContext: GrowthOperatorNotificationRoutingContext,
): GrowthOperatorNotificationRecipient[] {
  const recipients: GrowthOperatorNotificationRecipient[] = []

  if (routingContext.inboxOwnerUserId) {
    recipients.push({ role: "inbox_owner", userId: routingContext.inboxOwnerUserId })
  }
  if (routingContext.leadOwnerUserId) {
    recipients.push({ role: "lead_owner", userId: routingContext.leadOwnerUserId })
  }
  if (shouldUseInboxSlaPlatformAdminFallback(event, routingContext)) {
    recipients.push({ role: "platform_admin", userId: null })
  }

  return recipients
}

async function loadInboxThreadSlaOperatorContext(
  admin: SupabaseClient,
  input: { threadId: string; leadId: string | null; inboxOwnerUserId: string | null },
): Promise<{
  companyLabel: string
  organizationId: string | null
  routingContext: GrowthOperatorNotificationRoutingContext
}> {
  let companyLabel = "Lead"
  let organizationId: string | null = null
  let leadOwnerUserId: string | null = null

  if (input.leadId) {
    const { data, error } = await admin
      .schema("growth")
      .from("leads")
      .select("company_name, promoted_organization_id, assigned_to")
      .eq("id", input.leadId)
      .maybeSingle()

    if (!error && data) {
      companyLabel =
        typeof data.company_name === "string" && data.company_name.trim()
          ? data.company_name.trim()
          : "Lead"
      organizationId =
        typeof data.promoted_organization_id === "string" ? data.promoted_organization_id : null
      leadOwnerUserId = typeof data.assigned_to === "string" ? data.assigned_to : null
    }
  }

  return {
    companyLabel,
    organizationId,
    routingContext: {
      inboxOwnerUserId: input.inboxOwnerUserId,
      leadOwnerUserId,
      campaignOwnerUserId: null,
    },
  }
}

export async function emitInboxThreadSlaOperatorNotification(
  admin: SupabaseClient,
  input: {
    event: GrowthOperatorNotificationInboxEvent
    threadId: string
    leadId: string | null
    inboxOwnerUserId: string | null
    slaDueAt: string
    occurredAt?: string
  },
): Promise<void> {
  const context = await loadInboxThreadSlaOperatorContext(admin, {
    threadId: input.threadId,
    leadId: input.leadId,
    inboxOwnerUserId: input.inboxOwnerUserId,
  })

  const content = buildGrowthInboxOperatorNotificationContent({
    event: input.event,
    companyLabel: context.companyLabel,
  })

  const dedupe = {
    sourceSystem: "inbox_sla",
    sourceId: buildInboxThreadSlaOperatorNotificationDedupeSourceId({
      threadId: input.threadId,
      event: input.event,
    }),
    leadId: input.leadId,
    threadId: input.threadId,
  }

  const payload = {
    qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
    thread_id: input.threadId,
    lead_id: input.leadId,
    sla_due_at: input.slaDueAt,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  }

  const recipients = resolveInboxThreadSlaOperatorRecipients(input.event, context.routingContext)
  if (recipients.length === 0) return

  for (const recipient of recipients) {
    await createGrowthNotification(admin, {
      organizationId: context.organizationId,
      event: input.event,
      title: content.title,
      body: content.body,
      payload,
      targetEntityType: "inbox_thread",
      targetEntityId: input.threadId,
      routingContext: context.routingContext,
      recipientRole: recipient.role,
      recipientUserId: recipient.userId,
      dedupe,
    })
  }
}

export async function emitInboxThreadSlaOperatorNotificationSafely(
  admin: SupabaseClient,
  input: Parameters<typeof emitInboxThreadSlaOperatorNotification>[1],
): Promise<void> {
  await emitInboxThreadSlaOperatorNotification(admin, input).catch(() => undefined)
}
