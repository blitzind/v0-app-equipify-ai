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
