/** Growth Engine SR-2B-5 — Share page operator/admin DTOs (client-safe). */

import type {
  GrowthSharePage,
  GrowthSharePageAnalyticsSummary,
  GrowthSharePageEngagementSummary,
  GrowthSharePageEvent,
  GrowthSharePagePersonalizationContext,
  GrowthSharePageStatus,
  GrowthSharePageSourceChannel,
} from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER = "share-pages-operator-sr2b5-v1" as const

export const GROWTH_SHARE_PAGES_OPERATOR_CONFIRM = "RUN_GROWTH_SHARE_PAGES_OPERATOR_CERTIFICATION" as const

export type GrowthSharePageListItem = {
  id: string
  organizationId: string
  leadId: string
  leadLabel: string
  companyName: string
  status: GrowthSharePageStatus
  sourceChannel: GrowthSharePageSourceChannel
  tokenPrefix: string
  viewCount: number
  ctaClickCount: number
  bookingCompletedCount: number
  lastViewedAt: string | null
  createdAt: string
  updatedAt: string
  requiresHumanReview: true
}

export type GrowthSharePageOperatorDetail = {
  page: GrowthSharePage
  leadLabel: string
  companyName: string
  contactName: string | null
  analytics: GrowthSharePageAnalyticsSummary | null
  recentEvents: GrowthSharePageEvent[]
  previewPath: string
  publicPath: string | null
  tokenPrefix: string
  bookingPageId: string | null
  personalizationSnapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>
  engagementSummary: GrowthSharePageEngagementSummary
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
  qaMarker: typeof GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER
}

export type GrowthSharePageCreateResponse = {
  page: GrowthSharePage
  publicToken: string
  previewToken: string
  publicUrl: string
  previewUrl: string
  requiresHumanReview: true
}

export type GrowthSharePagePreviewResponse = {
  page: GrowthSharePage
  previewToken: string
  previewUrl: string
  context?: GrowthSharePagePersonalizationContext
}

export type GrowthSharePageApproveResponse = {
  page: GrowthSharePage
  publicUrl: string | null
  message: string
}
