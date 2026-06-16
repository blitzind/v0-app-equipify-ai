import type { GrowthOperatorNotificationReplyEvent } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"

export const GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER =
  "growth-reply-booking-notifications-sn4-v1" as const

export type GrowthReplyOperatorNotificationContentInput = {
  event: GrowthOperatorNotificationReplyEvent
  companyLabel: string
  intentLabel?: string | null
}

function normalizeCompanyLabel(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "Lead"
}

function normalizeIntentLabel(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return null
  return trimmed.replace(/_/g, " ")
}

export function resolveReplyIntentLabel(intent: GrowthReplyIntent): string {
  return intent.replace(/_/g, " ")
}

export function buildGrowthReplyOperatorNotificationContent(
  input: GrowthReplyOperatorNotificationContentInput,
): { title: string; body: string } {
  const company = normalizeCompanyLabel(input.companyLabel)
  const intentLabel = normalizeIntentLabel(input.intentLabel)

  switch (input.event) {
    case "reply_received":
      return {
        title: "Inbound reply received",
        body: intentLabel
          ? `${company} sent a reply (${intentLabel}).`
          : `${company} sent a new inbound reply.`,
      }
    case "reply_positive_interest":
      return {
        title: "Positive reply interest",
        body: `${company} showed positive buying interest in their reply.`,
      }
    case "reply_meeting_requested":
      return {
        title: "Meeting requested",
        body: `${company} requested a meeting from their reply.`,
      }
    case "reply_competitor_detected":
      return {
        title: "Competitor mentioned",
        body: `${company} mentioned a competitor in their reply.`,
      }
    default: {
      const _exhaustive: never = input.event
      return _exhaustive
    }
  }
}
