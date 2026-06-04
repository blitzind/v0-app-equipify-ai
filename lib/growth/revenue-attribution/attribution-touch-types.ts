/** Phase 6.32B-1 — Attribution touch ledger (client-safe). */

export const GROWTH_ATTRIBUTION_TOUCH_LEDGER_QA_MARKER = "growth-attribution-touch-ledger-v1" as const

export const GROWTH_ATTRIBUTION_TOUCH_LEDGER_MIGRATION =
  "20270706120000_growth_attribution_touch_ledger.sql" as const

export const GROWTH_ATTRIBUTION_TOUCH_TYPES = [
  "lead_import",
  "research",
  "personalization",
  "email_send",
  "sms_send",
  "call",
  "meeting",
  "reply",
  "opportunity_created",
  "opportunity_won",
] as const

export type GrowthAttributionTouchType = (typeof GROWTH_ATTRIBUTION_TOUCH_TYPES)[number]

export const GROWTH_ATTRIBUTION_PATH_SCOPES = ["lead", "opportunity"] as const
export type GrowthAttributionPathScope = (typeof GROWTH_ATTRIBUTION_PATH_SCOPES)[number]

export type GrowthAttributionTouch = {
  id: string
  touchType: GrowthAttributionTouchType
  touchedAt: string
  leadId: string
  opportunityId: string | null
  channel: string | null
  sequenceId: string | null
  sequenceStepId: string | null
  sequenceEnrollmentId: string | null
  senderAccountId: string | null
  repUserId: string | null
  campaignId: string | null
  deliveryAttemptId: string | null
  revenueAttributionEventId: string | null
  attributionSource: string
  attributionConfidence: number
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthAttributionPath = {
  id: string
  leadId: string
  opportunityId: string | null
  pathScope: GrowthAttributionPathScope
  touchIds: string[]
  firstTouchId: string | null
  lastTouchId: string | null
  firstTouchType: GrowthAttributionTouchType | null
  lastTouchType: GrowthAttributionTouchType | null
  touchCount: number
  channels: string[]
  attributionSources: string[]
  pathSummary: Record<string, unknown>
  rebuiltAt: string
}

export function defaultChannelForTouchType(touchType: GrowthAttributionTouchType): string {
  switch (touchType) {
    case "lead_import":
      return "import"
    case "research":
      return "research"
    case "personalization":
      return "personalization"
    case "email_send":
      return "email"
    case "sms_send":
      return "sms"
    case "call":
      return "call"
    case "meeting":
      return "meeting"
    case "reply":
      return "email"
    case "opportunity_created":
    case "opportunity_won":
      return "pipeline"
    default:
      return "unknown"
  }
}
