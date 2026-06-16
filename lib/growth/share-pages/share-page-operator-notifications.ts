import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationSharePageEvent } from "@/lib/growth/notifications/growth-notification-events"
import { buildGrowthSharePageOperatorNotificationContent } from "@/lib/growth/notifications/growth-share-page-notification-content"
import { createGrowthNotification } from "@/lib/growth/notifications/growth-notification-service"
import type {
  GrowthOperatorNotificationRecipient,
  GrowthOperatorNotificationRoutingContext,
} from "@/lib/growth/notifications/growth-notification-routing"
import type { GrowthSharePage } from "@/lib/growth/share-pages/share-page-types"

export function resolveSharePageOperatorNotificationRecipients(
  context: GrowthOperatorNotificationRoutingContext,
): GrowthOperatorNotificationRecipient[] {
  const leadOwnerUserId = context.leadOwnerUserId ?? null
  if (leadOwnerUserId) {
    return [{ role: "lead_owner", userId: leadOwnerUserId }]
  }
  return [{ role: "platform_admin", userId: null }]
}

export function buildSharePageOperatorNotificationRoutingContext(input: {
  leadOwnerUserId?: string | null
}): GrowthOperatorNotificationRoutingContext {
  return {
    leadOwnerUserId: input.leadOwnerUserId ?? null,
    inboxOwnerUserId: null,
    campaignOwnerUserId: null,
  }
}

export async function emitSharePageOperatorNotification(
  admin: SupabaseClient,
  input: {
    event: GrowthOperatorNotificationSharePageEvent
    page: GrowthSharePage
    sharePageViewId: string
    companyLabel: string
    leadOwnerUserId?: string | null
    occurredAt: string
    ctaLabel?: string | null
  },
): Promise<{ created: number; skipped: number }> {
  const content = buildGrowthSharePageOperatorNotificationContent({
    event: input.event,
    companyLabel: input.companyLabel,
    ctaLabel: input.ctaLabel ?? null,
  })

  const routingContext = buildSharePageOperatorNotificationRoutingContext({
    leadOwnerUserId: input.leadOwnerUserId ?? null,
  })
  const recipients = resolveSharePageOperatorNotificationRecipients(routingContext)

  let created = 0
  let skipped = 0

  for (const recipient of recipients) {
    const result = await createGrowthNotification(admin, {
      organizationId: input.page.organizationId,
      event: input.event,
      title: content.title,
      body: content.body,
      payload: {
        qa_marker: "growth-share-page-notifications-sn3-v1",
        share_page_id: input.page.id,
        share_page_view_id: input.sharePageViewId,
        lead_id: input.page.leadId,
        occurred_at: input.occurredAt,
        cta_label: input.ctaLabel ?? null,
      },
      targetEntityType: "share_page",
      targetEntityId: input.page.id,
      routingContext,
      recipientRole: recipient.role,
      recipientUserId: recipient.userId,
      dedupe: {
        sourceSystem: "share_page_analytics",
        sourceId: `${input.page.id}:${input.sharePageViewId}:${input.event}`,
        leadId: input.page.leadId,
        enrollmentId: input.page.enrollmentId,
      },
    })

    if (result.created) created += 1
    else skipped += 1
  }

  return { created, skipped }
}
