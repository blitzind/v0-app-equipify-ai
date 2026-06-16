import type { GrowthOperatorNotificationSequenceEvent } from "@/lib/growth/notifications/growth-notification-events"

export const GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER =
  "growth-sequence-notifications-sn5-v1" as const

export type GrowthSequenceOperatorNotificationContentInput = {
  event: GrowthOperatorNotificationSequenceEvent
  companyLabel: string
  campaignLabel: string
  waitedForEventLabel?: string | null
  resolutionReason?: string | null
  blockReason?: string | null
}

function normalizeLabel(value: string, fallback: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export function formatSequenceWaitedForEventLabel(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return "sequence event"
  return trimmed.replace(/\./g, " ").replace(/_/g, " ").trim()
}

export function buildGrowthSequenceOperatorNotificationContent(
  input: GrowthSequenceOperatorNotificationContentInput,
): { title: string; body: string } {
  const company = normalizeLabel(input.companyLabel, "Lead")
  const campaign = normalizeLabel(input.campaignLabel, "Sequence")
  const waitedFor = formatSequenceWaitedForEventLabel(input.waitedForEventLabel)
  const resolutionReason = input.resolutionReason?.trim() || null
  const blockReason = input.blockReason?.trim() || null

  switch (input.event) {
    case "sequence_wait_started":
      return {
        title: "Sequence wait started",
        body: `${company} is waiting for ${waitedFor} on ${campaign}.`,
      }
    case "sequence_wait_resolved":
      return {
        title: "Sequence wait resolved",
        body: resolutionReason
          ? `${company} wait resolved (${resolutionReason}) on ${campaign}.`
          : `${company} wait resolved and branch selected on ${campaign}.`,
      }
    case "sequence_wait_timeout":
      return {
        title: "Sequence wait timed out",
        body: `${company} wait timed out on ${campaign}.`,
      }
    case "sequence_branch_evaluated":
      return {
        title: "Sequence branch evaluated",
        body: `${company} sequence branch evaluated on ${campaign}.`,
      }
    case "sequence_advancement_blocked":
      return {
        title: "Sequence advancement blocked",
        body: blockReason
          ? `${company} sequence advancement blocked on ${campaign}: ${blockReason}.`
          : `${company} sequence advancement blocked on ${campaign}.`,
      }
    default: {
      const _exhaustive: never = input.event
      return _exhaustive
    }
  }
}
