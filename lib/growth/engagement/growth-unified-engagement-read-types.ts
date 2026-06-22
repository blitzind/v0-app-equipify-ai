/** GE-v1-2 — Unified operator engagement read model (client-safe). */

export const GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER = "ge-v1-2-unified-engagement-read-v1" as const

export type GrowthUnifiedEngagementIntensity = "low" | "medium" | "high" | "critical"

export type GrowthUnifiedEngagementRow = {
  id: string
  prospectName: string | null
  companyName: string | null
  campaignOrPage: string | null
  eventType: string
  eventLabel: string
  occurredAt: string
  intensity: GrowthUnifiedEngagementIntensity
  recommendedAction: string | null
  recommendedActionHref: string | null
  source: string
  leadId: string | null
  landingPageId: string | null
}

export type GrowthUnifiedEngagementFeedPayload = {
  qaMarker: typeof GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER
  generatedAt: string
  rows: GrowthUnifiedEngagementRow[]
  sourceCounts: Record<string, number>
}
