/** SN-1 — pure operator notification routing (recipients only; no delivery). */

import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"

export const GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES = [
  "lead_owner",
  "inbox_owner",
  "campaign_owner",
  "platform_admin",
] as const

export type GrowthOperatorNotificationRecipientRole =
  (typeof GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES)[number]

export type GrowthOperatorNotificationRoutingContext = {
  leadOwnerUserId?: string | null
  inboxOwnerUserId?: string | null
  campaignOwnerUserId?: string | null
}

export type GrowthOperatorNotificationRecipient = {
  role: GrowthOperatorNotificationRecipientRole
  userId: string | null
}

const EVENT_RECIPIENT_ROLES: Record<
  GrowthOperatorNotificationEvent,
  readonly GrowthOperatorNotificationRecipientRole[]
> = {
  lead_hot: ["lead_owner"],
  engagement_spike: ["lead_owner"],
  share_page_viewed: ["lead_owner"],
  share_page_engaged: ["lead_owner"],
  share_page_cta_clicked: ["lead_owner"],
  share_page_booking_started: ["lead_owner", "campaign_owner"],
  share_page_booking_completed: ["lead_owner", "campaign_owner"],
  reply_received: ["lead_owner", "inbox_owner"],
  reply_positive_interest: ["lead_owner", "inbox_owner"],
  reply_meeting_requested: ["lead_owner", "inbox_owner", "platform_admin"],
  reply_competitor_detected: ["lead_owner", "inbox_owner"],
  sequence_wait_started: ["campaign_owner"],
  sequence_wait_resolved: ["campaign_owner", "lead_owner"],
  sequence_wait_timeout: ["campaign_owner", "lead_owner"],
  sequence_branch_evaluated: ["campaign_owner"],
  sequence_advancement_blocked: ["campaign_owner", "lead_owner", "platform_admin"],
  sms_reply_received: ["inbox_owner", "lead_owner"],
  voice_drop_failed: ["campaign_owner", "lead_owner"],
  thread_sla_at_risk: ["inbox_owner", "lead_owner"],
  thread_sla_overdue: ["inbox_owner", "lead_owner"],
}

function resolveRecipientUserId(
  role: GrowthOperatorNotificationRecipientRole,
  context: GrowthOperatorNotificationRoutingContext,
): string | null {
  switch (role) {
    case "lead_owner":
      return context.leadOwnerUserId ?? null
    case "inbox_owner":
      return context.inboxOwnerUserId ?? null
    case "campaign_owner":
      return context.campaignOwnerUserId ?? null
    case "platform_admin":
      return null
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

export function resolveGrowthOperatorNotificationRecipientRoles(
  event: GrowthOperatorNotificationEvent,
): readonly GrowthOperatorNotificationRecipientRole[] {
  return EVENT_RECIPIENT_ROLES[event]
}

export function resolveGrowthOperatorNotificationRecipients(
  event: GrowthOperatorNotificationEvent,
  context: GrowthOperatorNotificationRoutingContext,
): GrowthOperatorNotificationRecipient[] {
  const roles = resolveGrowthOperatorNotificationRecipientRoles(event)
  const seen = new Set<GrowthOperatorNotificationRecipientRole>()
  const recipients: GrowthOperatorNotificationRecipient[] = []

  for (const role of roles) {
    if (seen.has(role)) continue
    seen.add(role)
    recipients.push({
      role,
      userId: resolveRecipientUserId(role, context),
    })
  }

  return recipients
}
