/**
 * GE-AIOS-OPERATOR-UX-2C — Home + Review operator vocabulary (presentation-only, client-safe).
 * Single package/review lexicon; counts align with pendingApprovalCount authority.
 */

export const GROWTH_OPERATOR_HOME_LANGUAGE_2C_QA_MARKER =
  "ge-aios-operator-ux-2c-home-language-v1" as const

export const GROWTH_OPERATOR_REVIEW_CTA_LABEL = "Review package" as const
export const GROWTH_OPERATOR_REVIEW_ALL_CTA_LABEL = "Review packages" as const
export const GROWTH_OPERATOR_VIEW_RESEARCH_CTA_LABEL = "View research" as const

export const GROWTH_OPERATOR_STATUS_READY_FOR_REVIEW = "Ready for review" as const
export const GROWTH_OPERATOR_STATUS_AWAITING_REVIEW = "Awaiting your review" as const

export const GROWTH_OPERATOR_PRIORITY_CARD_TITLE = "Ready for your review" as const

export const GROWTH_OPERATOR_PACKAGES_EMPTY_TITLE =
  "No packages are waiting for review." as const

export const GROWTH_OPERATOR_PACKAGES_EMPTY_DETAIL =
  "Ava will return here when another opportunity package is ready." as const

export const GROWTH_OPERATOR_PORTFOLIO_EXPLANATION =
  "Ava is building your active portfolio from qualified discoveries." as const

export const GROWTH_OPERATOR_PACKAGES_READY_FOLLOW_ON =
  "Once you've reviewed them, I'll continue preparing the remaining opportunities in the background." as const

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/** Primary Home waiting summary — package count from pendingApprovalCount. */
export function formatOperatorPackagesReadySummary(input: {
  packageCount: number
  replyCount?: number
}): string {
  const packages = Math.max(input.packageCount, 0)
  const replies = Math.max(input.replyCount ?? 0, 0)

  if (packages > 0 && replies > 0) {
    return `I have ${packages} opportunity ${pluralize(packages, "package", "packages")} ready for your review, and ${replies} ${pluralize(replies, "reply needs", "replies need")} your response.`
  }
  if (packages > 0) {
    return `I have ${packages} opportunity ${pluralize(packages, "package", "packages")} ready for your review.`
  }
  if (replies > 0) {
    return `${replies} ${pluralize(replies, "reply needs", "replies need")} your response before I can continue.`
  }
  return `${GROWTH_OPERATOR_PACKAGES_EMPTY_TITLE} ${GROWTH_OPERATOR_PACKAGES_EMPTY_DETAIL}`
}

/** Hero / supervised-sales headline when packages are waiting. */
export function formatOperatorPackagesReadyHeadline(packageCount: number): string {
  const count = Math.max(packageCount, 0)
  if (count === 0) return GROWTH_OPERATOR_PACKAGES_EMPTY_TITLE
  if (count === 1) return "1 opportunity package is ready for your review."
  return `${count} opportunity packages are ready for your review.`
}

/** Daily activity waiting lines — package vocabulary, no draft-as-task wording. */
export function formatOperatorDailyActivityWaitingLine(packageCount: number): string | null {
  const count = Math.max(packageCount, 0)
  if (count <= 0) return null
  return formatOperatorPackagesReadySummary({ packageCount: count })
}

export function formatOperatorDailyActivityWaitingFollowOn(packageCount: number): string | null {
  const count = Math.max(packageCount, 0)
  if (count <= 0) return null
  return GROWTH_OPERATOR_PACKAGES_READY_FOLLOW_ON
}

/** Priority card title for a named opportunity package. */
export function formatOperatorPriorityPackageTitle(companyName: string): string {
  const name = companyName.trim()
  if (!name) return "Review opportunity package"
  return `Review opportunity package — ${name}`
}

/** Priority card detail — editable content counts use draft only inside package context. */
export function formatOperatorPriorityPackageDetail(input: {
  channelLabel?: string | null
  emailDraftCount?: number
  linkedInDraftCount?: number
}): string {
  const channel = input.channelLabel?.trim() || "Outreach strategy"
  const parts: string[] = [`${channel} prepared`]
  const emailCount = Math.max(input.emailDraftCount ?? 0, 0)
  const linkedInCount = Math.max(input.linkedInDraftCount ?? 0, 0)
  if (emailCount > 0) {
    parts.push(`${emailCount} email ${pluralize(emailCount, "draft", "drafts")}`)
  }
  if (linkedInCount > 0) {
    parts.push(`${linkedInCount} LinkedIn ${pluralize(linkedInCount, "draft", "drafts")}`)
  }
  return parts.join(" · ")
}

export function formatOperatorPriorityRecommendedNextStep(): string {
  return "Review the proposed outreach strategy before authorization."
}

/** Opening line when packages need review — replaces fragmented approval phrasing. */
export function formatOperatorHomeOpeningWithPackages(packageCount: number): string | null {
  const count = Math.max(packageCount, 0)
  if (count <= 0) return null
  return formatOperatorPackagesReadySummary({ packageCount: count })
}

export function formatOperatorApprovalStoryLine(packageCount: number): string | null {
  const count = Math.max(packageCount, 0)
  if (count <= 0) return null
  return formatOperatorPackagesReadySummary({ packageCount: count })
}

export function formatOperatorEmployeeStatusLabel(packageCount: number): string {
  return packageCount > 0 ? GROWTH_OPERATOR_STATUS_READY_FOR_REVIEW : "Working"
}

export function formatOperatorEmployeeActivityLabel(packageCount: number): string {
  if (packageCount <= 0) return "advancing your revenue priorities"
  return `${packageCount} ${pluralize(packageCount, "package", "packages")} ready for your review`
}

export function formatOperatorWaitingActivityLabel(packageCount: number): string {
  if (packageCount <= 0) return GROWTH_OPERATOR_STATUS_AWAITING_REVIEW
  return `${packageCount} ${pluralize(packageCount, "package", "packages")} ready for review`
}

export function formatOperatorReviewWorkspaceCaughtUpTitle(): string {
  return GROWTH_OPERATOR_PACKAGES_EMPTY_TITLE
}

export function formatOperatorReviewWorkspaceCaughtUpMessage(): string {
  return GROWTH_OPERATOR_PACKAGES_EMPTY_DETAIL
}

export function formatOperatorQueueWaitingReason(): string {
  return GROWTH_OPERATOR_STATUS_AWAITING_REVIEW
}

export function formatOperatorCompletedWorkCta(bucket: string): string {
  if (bucket === "ready_outreach") return GROWTH_OPERATOR_REVIEW_CTA_LABEL
  return "Review"
}
