/** GE-AIOS-OPERATOR-UX-1A — Operator package review presentation copy (client-safe). */

export const GROWTH_OPERATOR_PACKAGE_REVIEW_ENTRY_1A_QA_MARKER =
  "ge-aios-operator-ux-1a-package-review-entry-v1" as const

/** Home priority decision — concise authorization promise. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_HOME =
  "Approve the prepared outreach package. I will not send anything until you separately authorize sending." as const

/** Canonical operator task — full authorization promise. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK =
  "Approve this package to authorize my outreach plan and drafts. I will not send anything until you separately approve sending." as const

/** Post-authorize success on the canonical package card. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS =
  "Package approved. I will not send outreach until you separately approve sending." as const

/** Canonical package card — pre-action reassurance. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PRE_ACTION =
  "Approving authorizes my strategy and prepared content only. Nothing sends until you separately approve sending." as const

export const GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_TITLE =
  "Two-step approval" as const

export const GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS = [
  {
    id: "authorize_package",
    label: "Approve package",
    detail: "Approve my outreach plan and prepared drafts.",
  },
  {
    id: "transport_approval",
    label: "Approve sending",
    detail: "When sending is enabled, approve outbound delivery separately before anything sends.",
  },
] as const

/** GE-AIOS-OPERATOR-UX-1C — Package authorization vs transport execution readiness. */
export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_HEADLINE =
  "Ready for your approval" as const

export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_DETAIL =
  "I've prepared my strategy and drafts for your decision." as const

export const GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_TITLE =
  "Sending setup incomplete" as const

export const GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL =
  "You can approve this package, but I cannot send outreach until sending setup is complete and you separately approve delivery." as const

export const GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION =
  "Package approved. I will not send until sending setup is complete and you separately approve delivery." as const

export const GROWTH_OPERATOR_PACKAGE_INCOMPLETE_BLOCK_PREFIX =
  "Approval is unavailable until the package is complete:" as const

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
