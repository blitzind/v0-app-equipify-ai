/** Growth Engine SP-UX-2 — Operator workspace summary cards (client-safe). */

import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  GrowthSharePage,
  GrowthSharePageAnalyticsSummary,
  GrowthSharePagePersonalizationContext,
} from "@/lib/growth/share-pages/share-page-types"
import type {
  GrowthSharePageOperatorDraftStatusLabel,
  GrowthSharePageOperatorWorkspaceActions,
  GrowthSharePageOperatorWorkspaceOperatorState,
  GrowthSharePageOperatorWorkspaceSummaryCards,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function asPersonalizationContext(
  snapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>,
): GrowthSharePagePersonalizationContext | null {
  if (!snapshot || typeof snapshot !== "object") return null
  if ("headline" in snapshot && "personalizedMessage" in snapshot) {
    return snapshot as GrowthSharePagePersonalizationContext
  }
  return null
}

export function resolveGrowthSharePageOperatorDraftStatusLabel(input: {
  page: GrowthSharePage
  operatorState: GrowthSharePageOperatorWorkspaceOperatorState
}): GrowthSharePageOperatorDraftStatusLabel {
  const { page, operatorState } = input
  if (page.status === "archived") return "Archived"
  if (page.status === "published") return "Published"
  if (page.status === "revoked") return "Revoked"
  if (page.status === "expired") return "Expired"
  if (operatorState.draftApprovedAt) return "Approved"
  if (page.status === "pending_review") return "Pending Review"
  return "Draft"
}

export function buildGrowthSharePageOperatorSummaryCards(input: {
  page: GrowthSharePage
  lead: GrowthLead | null
  analytics: GrowthSharePageAnalyticsSummary | null
  templateName: string | null
  operatorState: GrowthSharePageOperatorWorkspaceOperatorState
}): GrowthSharePageOperatorWorkspaceSummaryCards {
  const context = asPersonalizationContext(input.page.personalizationSnapshot)
  const engagement = input.analytics?.engagementSummary ?? input.page.engagementSummary
  const mergeSource = [
    input.page.headline,
    input.page.subheadline ?? "",
    input.page.heroMessage,
    input.page.whyReachingOut ?? "",
    ...input.page.companyObservations,
  ].join("\n")
  const variablesUsed = extractContentMergeFields(mergeSource).length

  return {
    draftStatus: resolveGrowthSharePageOperatorDraftStatusLabel({
      page: input.page,
      operatorState: input.operatorState,
    }),
    personalizationScore: context?.evidenceCoverageScore ?? input.page.evidenceCoverageScore ?? 0,
    variablesUsed,
    templateName: input.templateName,
    lastGeneratedAt: context?.generatedAt ?? input.operatorState.lastPersonalizationRebuildAt ?? input.page.updatedAt,
    views: engagement.viewCount,
    uniqueVisitors: engagement.uniqueSessionCount,
    ctaClicks: engagement.ctaClickCount,
    calendarClicks: engagement.bookingStartedCount + engagement.bookingCompletedCount,
    fitScore: input.lead?.score ?? null,
    momentum: input.lead?.momentumScore ?? null,
    nextBestAction: input.lead?.nextBestAction ?? null,
    relationshipHealth: input.lead?.relationshipStrengthTier ?? input.lead?.relationshipSummary ?? null,
  }
}

export function buildGrowthSharePageOperatorWorkspaceActions(input: {
  page: GrowthSharePage
  operatorState: GrowthSharePageOperatorWorkspaceOperatorState
  hasPublicUrl: boolean
}): GrowthSharePageOperatorWorkspaceActions {
  const { page, operatorState } = input
  const editable = page.status === "draft" || page.status === "pending_review"
  const approved = Boolean(operatorState.draftApprovedAt)
  const published = page.status === "published"
  const archived = page.status === "archived"

  return {
    approveDraft: archived || published || approved ? "completed" : editable ? "idle" : "unavailable",
    publish: published
      ? "completed"
      : archived || !approved
        ? "unavailable"
        : "idle",
    duplicate: archived ? "unavailable" : "idle",
    archive: archived ? "completed" : "idle",
    rebuildPersonalization: archived || published ? "unavailable" : "idle",
    openPublicPage: published && input.hasPublicUrl ? "idle" : published ? "unavailable" : "unavailable",
  }
}

export function emptyGrowthSharePageOperatorWorkspaceOperatorState(): GrowthSharePageOperatorWorkspaceOperatorState {
  return {
    draftApprovedAt: null,
    draftApprovedBy: null,
    lastPersonalizationRebuildAt: null,
    updatedAt: null,
  }
}
