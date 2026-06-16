import type { GrowthOperatorNotificationSharePageEvent } from "@/lib/growth/notifications/growth-notification-events"

export const GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER =
  "growth-share-page-notifications-sn3-v1" as const

export type GrowthSharePageOperatorNotificationContentInput = {
  event: GrowthOperatorNotificationSharePageEvent
  companyLabel: string
  ctaLabel?: string | null
}

function normalizeCompanyLabel(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "Lead"
}

export function buildGrowthSharePageOperatorNotificationContent(
  input: GrowthSharePageOperatorNotificationContentInput,
): { title: string; body: string } {
  const company = normalizeCompanyLabel(input.companyLabel)

  switch (input.event) {
    case "share_page_viewed":
      return {
        title: "Share page viewed",
        body: `${company} viewed the personalized share page.`,
      }
    case "share_page_engaged":
      return {
        title: "Share page engaged",
        body: `${company} crossed the engagement threshold on the share page.`,
      }
    case "share_page_cta_clicked":
      return {
        title: "Share page CTA clicked",
        body: input.ctaLabel?.trim()
          ? `${company} clicked "${input.ctaLabel.trim()}" on the share page.`
          : `${company} clicked a CTA on the share page.`,
      }
    case "share_page_booking_started":
      return {
        title: "Share page booking started",
        body: `${company} started the booking flow from the share page.`,
      }
    case "share_page_booking_completed":
      return {
        title: "Share page booking completed",
        body: `${company} completed booking from the share page.`,
      }
    default: {
      const _exhaustive: never = input.event
      return _exhaustive
    }
  }
}
