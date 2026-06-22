/**
 * GS-GROWTH-OPS-7B — Growth test data reset constants and env allowlists.
 */

export const GROWTH_TEST_DATA_RESET_QA_MARKER = "growth-ops-test-data-reset-7b-v1" as const

export const PRECISION_BIOMEDICAL_ORG_SLUG = "precision-biomedical-demo" as const
export const PRECISION_BIOMEDICAL_ORG_NAME = "Precision Biomedical Services" as const

export const GROWTH_RESET_CONFIRM_ENV = "GROWTH_RESET_TEST_DATA_CONFIRM" as const
export const GROWTH_RESET_CONFIRM_VALUE = "yes" as const

export const REPORT_PATHS = {
  before: "tmp/growth-reset-report-before.json",
  after: "tmp/growth-reset-report-after.json",
  summary: "tmp/growth-reset-summary.json",
} as const

export type GrowthResetTableClassification = "KEEP" | "DELETE" | "MANUAL_REVIEW"

export type GrowthResetGoldenEntityKey =
  | "organization"
  | "lead"
  | "company"
  | "contact"
  | "person"
  | "opportunity"
  | "meeting"
  | "generation"
  | "sequence_enrollment"
  | "inbox_thread"
  | "call_session"
  | "timeline"

export function parseCsvEnvIds(key: string): string[] {
  const raw = process.env[key]?.trim()
  if (!raw) return []
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

export const PRESERVED_ORGANIZATION_IDS_ENV = "GROWTH_RESET_PRESERVED_ORGANIZATION_IDS"
export const PRESERVED_LEAD_IDS_ENV = "GROWTH_RESET_PRESERVED_LEAD_IDS"
export const PRESERVED_COMPANY_IDS_ENV = "GROWTH_RESET_PRESERVED_COMPANY_IDS"
export const PRESERVED_CONTACT_IDS_ENV = "GROWTH_RESET_PRESERVED_CONTACT_IDS"
export const PRESERVED_PERSON_IDS_ENV = "GROWTH_RESET_PRESERVED_PERSON_IDS"
export const PRESERVED_OPPORTUNITY_IDS_ENV = "GROWTH_RESET_PRESERVED_OPPORTUNITY_IDS"
export const PRESERVED_MEETING_IDS_ENV = "GROWTH_RESET_PRESERVED_MEETING_IDS"
export const PRESERVED_GENERATION_IDS_ENV = "GROWTH_RESET_PRESERVED_GENERATION_IDS"
export const PRESERVED_SEQUENCE_ENROLLMENT_IDS_ENV = "GROWTH_RESET_PRESERVED_SEQUENCE_ENROLLMENT_IDS"
export const PRESERVED_INBOX_THREAD_IDS_ENV = "GROWTH_RESET_PRESERVED_INBOX_THREAD_IDS"
export const PRESERVED_CALL_SESSION_IDS_ENV = "GROWTH_RESET_PRESERVED_CALL_SESSION_IDS"
