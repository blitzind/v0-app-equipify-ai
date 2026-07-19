/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Survivor inventory types (client-safe).
 */

export const GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER =
  "ge-aios-first-customer-portfolio-intake-1d-v1" as const

/** Every non-promoted survivor lands in exactly one of these categories. */
export const PORTFOLIO_INTAKE_SURVIVOR_CLASSIFICATIONS = [
  "already_existing_lead",
  "already_existing_customer",
  "duplicate_company",
  "duplicate_contact",
  "research_already_complete",
  "research_pending",
  "waiting_for_batch_promotion",
  "waiting_for_scheduler",
  "portfolio_capacity_limit",
  "explicit_rejection",
  "bug",
  "unknown",
] as const

export type PortfolioIntakeSurvivorClassification =
  (typeof PORTFOLIO_INTAKE_SURVIVOR_CLASSIFICATIONS)[number]

export type PortfolioIntakeDecisionTrace = {
  function: string
  file: string
  condition: string
  returnPath: string
  stoppingReason: string
}

export type PortfolioIntakeSurvivorInventoryRow = {
  survivorKey: string
  canonicalCompanyKey: string
  company: string
  website: string | null
  runId: string
  audienceId: string | null
  discoveryDate: string
  score: number
  runRank: number
  runSurvivorCount: number
  batchSizeAtRun: number | null
  researchStatus: "complete" | "started" | "none"
  leadStatus: "promoted" | "not_promoted"
  leadId: string | null
  admissionStatus: string | null
  classification: PortfolioIntakeSurvivorClassification | "promoted_to_lead"
  promotionCorrect: boolean | null
  decisionTrace: PortfolioIntakeDecisionTrace
  notes: string
}

export type PortfolioIntakeClassificationSummary = {
  classification: PortfolioIntakeSurvivorClassification | "promoted_to_lead"
  count: number
}

export type PortfolioIntakeThroughputProjection = {
  prospectSearchSurvivors: number
  leadsCreated: number
  researchInitiated: number
  approvalPackages: number
  outreachReady: number
  basis: string
}
