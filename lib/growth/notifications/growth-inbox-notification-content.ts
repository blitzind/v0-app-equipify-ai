import type { GrowthOperatorNotificationInboxEvent } from "@/lib/growth/notifications/growth-notification-events"

export const GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER =
  "growth-inbox-notifications-sn6-v1" as const

export type GrowthInboxOperatorNotificationContentInput = {
  event: GrowthOperatorNotificationInboxEvent
  companyLabel: string
}

function normalizeLabel(value: string, fallback: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export function buildGrowthInboxOperatorNotificationContent(
  input: GrowthInboxOperatorNotificationContentInput,
): { title: string; body: string } {
  const company = normalizeLabel(input.companyLabel, "Lead")

  switch (input.event) {
    case "thread_sla_at_risk":
      return {
        title: "Reply SLA approaching",
        body: `${company} conversation needs attention soon.`,
      }
    case "thread_sla_overdue":
      return {
        title: "Reply SLA overdue",
        body: `${company} conversation requires immediate attention.`,
      }
    default: {
      const _exhaustive: never = input.event
      return _exhaustive
    }
  }
}
