/** Growth Engine SP-UX-2 — Share page operator workspace types (client-safe). */

import { GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER } from "@/lib/growth/share-pages/share-page-operator-types"
import type {
  GrowthSharePage,
  GrowthSharePageCTA,
  GrowthSharePagePersonalizationContext,
  GrowthSharePageTheme,
} from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER =
  "growth-share-page-operator-workspace-spux2-v1" as const

export const GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_CONFIRM =
  "RUN_GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_CERTIFICATION" as const

export const GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_METADATA_KEY = "growth_share_page_operator_spux2" as const

export type GrowthSharePageOperatorWorkspaceActionStatus = "idle" | "completed" | "unavailable"

export type GrowthSharePageOperatorDraftStatusLabel =
  | "Draft"
  | "Pending Review"
  | "Approved"
  | "Published"
  | "Archived"
  | "Revoked"
  | "Expired"

export type GrowthSharePageOperatorWorkspaceSummaryCards = {
  draftStatus: GrowthSharePageOperatorDraftStatusLabel
  personalizationScore: number
  variablesUsed: number
  templateName: string | null
  lastGeneratedAt: string | null
  views: number
  uniqueVisitors: number
  ctaClicks: number
  calendarClicks: number
  fitScore: number | null
  momentum: number | null
  nextBestAction: string | null
  relationshipHealth: string | null
}

export type GrowthSharePageOperatorWorkspaceActions = {
  approveDraft: GrowthSharePageOperatorWorkspaceActionStatus
  publish: GrowthSharePageOperatorWorkspaceActionStatus
  duplicate: GrowthSharePageOperatorWorkspaceActionStatus
  archive: GrowthSharePageOperatorWorkspaceActionStatus
  rebuildPersonalization: GrowthSharePageOperatorWorkspaceActionStatus
  openPublicPage: GrowthSharePageOperatorWorkspaceActionStatus
}

export type GrowthSharePageOperatorWorkspaceOperatorState = {
  draftApprovedAt: string | null
  draftApprovedBy: string | null
  lastPersonalizationRebuildAt: string | null
  updatedAt: string | null
}

export type GrowthSharePageOperatorLeadContext = {
  recipient: {
    name: string | null
    company: string | null
    email: string | null
    title: string | null
  }
  research: {
    painPoints: string[]
    outreachAngles: string[]
    lastActivity: string | null
    fitSummary: string | null
  }
  relationship: {
    lastInteraction: string | null
    openOpportunities: string | null
    meetingReadiness: string | null
    nbaRecommendations: string | null
  }
}

export type GrowthSharePageOperatorReviewContext = {
  template: {
    name: string | null
    category: string | null
    lastUpdatedAt: string | null
  }
  personalization: {
    headline: string
    intro: string
    cta: string | null
    calendarUrl: string | null
    heroImageUrl: string | null
    logoUrl: string | null
    brandColors: { primary: string; accent: string }
  }
  mergeVariables: {
    used: string[]
    missing: string[]
    resolvedValues: Record<string, string>
  }
}

export type GrowthSharePageOperatorAnalyticsBreakdown = {
  deviceType: Record<string, number>
  browser: Record<string, number>
  referrer: Record<string, number>
}

export type GrowthSharePageOperatorAnalyticsPanel = {
  overview: {
    totalViews: number
    uniqueVisitors: number
    timeOnPageMs: number
    ctaClicks: number
    calendarClicks: number
    lastVisitAt: string | null
  }
  breakdowns: GrowthSharePageOperatorAnalyticsBreakdown
  trend: Array<{ occurredAt: string; label: string; eventType: string }>
}

export type GrowthSharePageOperatorTimelineEntry = {
  id: string
  kind:
    | "page_created"
    | "approved"
    | "published"
    | "viewed"
    | "cta_clicked"
    | "calendar_clicked"
    | "archived"
    | "personalization_rebuilt"
  title: string
  summary: string
  occurredAt: string
}

export type GrowthSharePageOperatorPreviewModel = {
  previewUrl: string | null
  publicUrl: string | null
  model: import("@/components/growth/share-pages/growth-share-page-preview-card").GrowthSharePagePreviewModel
}

export type GrowthSharePageOperatorWorkspaceView = {
  id: string
  organizationId: string
  leadId: string
  page: GrowthSharePage
  leadLabel: string
  companyName: string
  contactName: string | null
  summary: GrowthSharePageOperatorWorkspaceSummaryCards
  actions: GrowthSharePageOperatorWorkspaceActions
  operatorState: GrowthSharePageOperatorWorkspaceOperatorState
  leadContext: GrowthSharePageOperatorLeadContext
  review: GrowthSharePageOperatorReviewContext
  preview: GrowthSharePageOperatorPreviewModel
  analytics: GrowthSharePageOperatorAnalyticsPanel
  timeline: GrowthSharePageOperatorTimelineEntry[]
  personalizationSnapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>
  theme: GrowthSharePageTheme
  ctaConfig: GrowthSharePageCTA[]
  sourcesUsed: string[]
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  outreachExecution: false
  enrollmentExecution: false
}

export type GrowthSharePageOperatorWorkspaceListItem = Pick<
  GrowthSharePageOperatorWorkspaceView,
  | "id"
  | "organizationId"
  | "leadId"
  | "leadLabel"
  | "companyName"
  | "contactName"
  | "summary"
  | "actions"
  | "operatorState"
  | "requiresHumanReview"
  | "autonomousExecutionEnabled"
  | "outreachExecution"
  | "enrollmentExecution"
> & {
  status: GrowthSharePage["status"]
  updatedAt: string
}

export type GrowthSharePageOperatorWorkspaceMetadata = {
  qa_marker: typeof GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER
  parent_qa_marker: typeof GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER
  operatorStates: Record<string, GrowthSharePageOperatorWorkspaceOperatorState>
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export function growthSharePageOperatorWorkspaceSafetyPayload() {
  return {
    qa_marker: GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
    outreach_execution: false as const,
    enrollment_execution: false as const,
    worker_execution_enabled: false as const,
    orchestration_enabled: false as const,
  }
}
