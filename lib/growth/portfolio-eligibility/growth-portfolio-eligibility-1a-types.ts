import type { GrowthCanonicalLeadLifecycleSnapshot } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"

export const GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER =
  "ge-aios-portfolio-eligibility-closure-1a-v1" as const

export const GROWTH_PORTFOLIO_EMPTY_OR_INELIGIBLE_STOP_REASON =
  "empty_or_ineligible_portfolio" as const

export const GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY =
  "Ava is ready for more qualified accounts." as const

export const GROWTH_PORTFOLIO_NO_ELIGIBLE_RESEARCH_COPY =
  "No eligible accounts are available for research right now." as const

export type GrowthPortfolioEligibilityExclusionReason =
  | "hard_terminal_archived"
  | "hard_terminal_disqualified"
  | "hard_terminal_invalid"
  | "hard_terminal_duplicate"
  | "hard_terminal_company_closed"
  | "hard_terminal_closed_won"
  | "hard_terminal_closed_lost"
  | "hard_terminal_converted_customer"
  | "hard_terminal_unsubscribed"
  | "hard_terminal_compliance_suppressed"
  | "admission_invalid"
  | "admission_rejected"
  | "admission_review"
  | "wrong_organization_scope"
  | "lead_status_terminal"

export type GrowthPortfolioEligibilityResult = {
  qaMarker: typeof GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER
  eligible: boolean
  excludedBeforeRanking: boolean
  reasonCode: GrowthPortfolioEligibilityExclusionReason | null
}

export type GrowthPortfolioEligibilityContext = {
  qaMarker: typeof GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER
  organizationId: string
  eligibleLeadIds: ReadonlySet<string>
  eligibleCount: number
  excludedCount: number
  /** LIVE-8B — review + research-ready leads projected into Work Manager without changing eligibleLeadIds. */
  reviewResearchProjectionLeadIds: ReadonlySet<string>
  reviewResearchProjectionCount: number
}

export type GrowthPortfolioEligibilityLeadRecord = Pick<
  import("@/lib/growth/types").GrowthLead,
  | "id"
  | "companyName"
  | "status"
  | "archivedAt"
  | "metadata"
  | "promotedOrganizationId"
  | "workflowHealth"
  | "workflowHealthReason"
>
