/**
 * AVA-OPERATOR-EXPERIENCE-2A — Direct Ava operator Home vocabulary (presentation-only).
 * Aligns operator surfaces with: understand → decide → draft → review.
 */

import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthHomeRuntimeTrustPipelineStep } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export const GROWTH_OPERATOR_HOME_AVA_DIRECT_2A_QA_MARKER =
  "ava-operator-experience-2a-v1" as const

export const GROWTH_OPERATOR_HOME_READY_FOR_REVIEW_TITLE = "Ready for review" as const
export const GROWTH_OPERATOR_HOME_NEEDS_INFORMATION_TITLE = "Needs information" as const
export const GROWTH_OPERATOR_HOME_COMPLETED_COLLAPSED_TITLE = "Completed today" as const

const NEEDS_INFORMATION_PATTERN =
  /need(s)? (decision maker|more information|additional information)|website unavailable|identity unresolved|hold\b|missing contact|no contact|unresolved|verification|buying committee|cannot recommend|before i can recommend/i

const READY_FOR_REVIEW_PATTERN =
  /review (email draft|recommendation|draft)|email draft|ready for review|recommendation|outreach draft|approve outreach/i

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildAvaDirectReviewPipelineSteps(
  activeWork: AvaWorkItem | null,
): GrowthHomeRuntimeTrustPipelineStep[] {
  const type = activeWork?.type ?? null
  const stepOrder = [
    { id: "understood", label: "Company understood" },
    { id: "decision", label: "Decision made" },
    { id: "contact", label: "Contact selected" },
    { id: "draft", label: "Draft prepared" },
    { id: "approval", label: "Waiting for approval" },
  ]

  let activeIndex = -1
  if (type === "research") activeIndex = 0
  else if (type === "qualification") activeIndex = 1
  else if (type === "outreach") activeIndex = 3
  else if (type === "approval") activeIndex = 4
  else if (type === "reply" || type === "meeting") activeIndex = 4

  return stepOrder.map((step, index) => ({
    id: step.id,
    label: step.label,
    complete: activeIndex >= 0 && index < activeIndex,
    active: index === activeIndex,
  }))
}

export function formatOperatorPrimaryMissionLabel(input: {
  pendingDraftCount: number
  companyName?: string | null
}): string {
  const count = Math.max(input.pendingDraftCount, 0)
  const company = input.companyName?.trim()
  if (count <= 0) return "Review email drafts"
  if (count === 1 && company) return `Approve outreach for ${company}`
  if (count === 1) return "Review 1 email draft"
  return `Review ${count} email drafts`
}

export function formatOperatorDailyBriefOpening(input: {
  pendingDraftCount: number
  companiesReviewedToday?: number
  strongOpportunities?: number
  notAFit?: number
  needsInformation?: number
}): string | null {
  const drafts = Math.max(input.pendingDraftCount, 0)
  const reviewed = Math.max(input.companiesReviewedToday ?? 0, 0)
  const strong = Math.max(input.strongOpportunities ?? drafts, 0)
  const rejected = Math.max(input.notAFit ?? 0, 0)
  const needsInfo = Math.max(input.needsInformation ?? 0, 0)

  if (reviewed > 0) {
    const parts = [`I reviewed ${reviewed} ${pluralize(reviewed, "company", "companies")} today.`]
    if (strong > 0) {
      parts.push(
        `${strong} ${strong === 1 ? "is a strong opportunity" : "are strong opportunities"}.`,
      )
    }
    if (rejected > 0) {
      parts.push(`${rejected} ${rejected === 1 ? "was" : "were"} not a fit.`)
    }
    if (needsInfo > 0) {
      parts.push(
        `${needsInfo} ${needsInfo === 1 ? "needs" : "need"} additional information before I can recommend outreach.`,
      )
    }
    return parts.join(" ")
  }

  if (drafts <= 0) return null
  return drafts === 1
    ? "I finished reviewing a company, and 1 email draft is ready for your review."
    : `I finished reviewing companies, and ${drafts} email drafts are ready for your review.`
}

export function formatOperatorDailyBriefNeedLine(pendingDraftCount: number): string {
  const count = Math.max(pendingDraftCount, 0)
  if (count <= 0) return "I don't currently need anything from you."
  if (count === 1) return "I need your approval on 1 email draft before I continue."
  return `I need your approval on ${count} email drafts before I continue.`
}

export function formatCollapsedRejectedSummary(rejectedCount: number): string | null {
  const count = Math.max(rejectedCount, 0)
  if (count <= 0) return null
  return `${count} ${pluralize(count, "company", "companies")} reviewed and rejected today`
}

export function isNeedsInformationWaitingItem(item: GrowthHomeWaitingOnYouItem): boolean {
  const text = `${item.label} ${item.detail ?? ""}`
  return NEEDS_INFORMATION_PATTERN.test(text)
}

export function isReadyForReviewWaitingItem(item: GrowthHomeWaitingOnYouItem): boolean {
  if (item.category === "approval") return true
  const text = `${item.label} ${item.detail ?? ""}`
  return READY_FOR_REVIEW_PATTERN.test(text)
}

export function partitionOperatorWaitingItems(items: GrowthHomeWaitingOnYouItem[]): {
  readyForReview: GrowthHomeWaitingOnYouItem[]
  needsInformation: GrowthHomeWaitingOnYouItem[]
  other: GrowthHomeWaitingOnYouItem[]
} {
  const readyForReview: GrowthHomeWaitingOnYouItem[] = []
  const needsInformation: GrowthHomeWaitingOnYouItem[] = []
  const other: GrowthHomeWaitingOnYouItem[] = []

  for (const item of items) {
    if (isNeedsInformationWaitingItem(item)) {
      needsInformation.push(item)
      continue
    }
    if (isReadyForReviewWaitingItem(item)) {
      readyForReview.push(item)
      continue
    }
    other.push(item)
  }

  return { readyForReview, needsInformation, other }
}

export function inferDailyBriefReviewCounts(input: {
  pendingDraftCount: number
  completedTodayLines?: string[]
  needsInformationCount?: number
}): {
  companiesReviewedToday: number
  strongOpportunities: number
  notAFit: number
  needsInformation: number
} {
  const completed = input.completedTodayLines ?? []
  let reviewed = 0
  let rejected = 0
  let needsInfo = Math.max(input.needsInformationCount ?? 0, 0)

  for (const line of completed) {
    const lower = line.toLowerCase()
    if (/reject|not a fit|disqualif|declined|skipped/i.test(lower)) rejected += 1
    else if (/review|research|qualif|understood|decision|hold|needs information/i.test(lower)) reviewed += 1
  }

  const strong = Math.max(input.pendingDraftCount, 0)
  if (reviewed === 0 && (strong > 0 || rejected > 0 || needsInfo > 0)) {
    reviewed = strong + rejected + needsInfo
  }

  return {
    companiesReviewedToday: reviewed,
    strongOpportunities: strong,
    notAFit: rejected,
    needsInformation: needsInfo,
  }
}
