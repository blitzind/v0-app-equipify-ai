/** GE-AIOS-OPERATOR-UX-1A — Operator package review presentation copy (client-safe). */

export const GROWTH_OPERATOR_PACKAGE_REVIEW_ENTRY_1A_QA_MARKER =
  "ge-aios-operator-ux-1a-package-review-entry-v1" as const

/** Home priority decision — concise authorization promise. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_HOME =
  "Authorize the prepared outreach package. Sending remains separately gated." as const

/** Canonical operator task — full authorization promise. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK =
  "Authorize this package to approve Ava's outreach plan and drafts. Nothing will be sent until transport is separately approved." as const

/** Post-authorize success on the canonical package card. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS =
  "Package authorized. Outreach remains blocked until transport is separately approved." as const

/** Canonical package card — pre-action reassurance. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PRE_ACTION =
  "Authorizing approves the strategy and prepared content only. Nothing sends until transport is separately approved." as const

export const GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_TITLE =
  "Two-step approval" as const

export const GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS = [
  {
    id: "authorize_package",
    label: "Authorize package",
    detail: "Approve Ava's outreach plan and prepared drafts.",
  },
  {
    id: "transport_approval",
    label: "Transport approval",
    detail: "When sending is enabled, approve outbound transport separately before anything sends.",
  },
] as const

/** GE-AIOS-OPERATOR-UX-1C — Package authorization vs transport execution readiness. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_HEADLINE =
  "Package ready for authorization" as const

export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_DETAIL =
  "Ava's strategy and drafts are ready for your decision." as const

export const GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_TITLE =
  "Transport setup incomplete" as const

export const GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL =
  "This package can be authorized, but it cannot be sent until a sequence pattern and transport approval are available." as const

export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION =
  "Package authorized. Transport remains blocked until execution setup is complete and sending is separately approved." as const

export const GROWTH_OPERATOR_PACKAGE_INCOMPLETE_BLOCK_PREFIX =
  "Authorize is unavailable until the package is complete:" as const

export function resolvePackageAuthorizationReadiness(input: {
  packageId?: string | null
  leadId?: string | null
  generatedAssetCount?: number | null
  packageApprovalDecision?: string | null
}): { ready: boolean; blockReason: string | null } {
  if (!input.packageId?.trim() || !input.leadId?.trim()) {
    return { ready: false, blockReason: "package identity is incomplete" }
  }
  if ((input.generatedAssetCount ?? 0) <= 0) {
    return { ready: false, blockReason: "draft content is missing" }
  }
  if (input.packageApprovalDecision === "rejected") {
    return { ready: false, blockReason: "this package was rejected" }
  }
  return { ready: true, blockReason: null }
}
