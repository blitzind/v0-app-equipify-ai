/** Growth Engine — Company Contacts types (Apollo replacement layer). Client-safe. */

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_COMPANY_CONTACTS_QA_MARKER = "growth-company-contacts-v1" as const

export const GROWTH_COMPANY_CONTACT_EMAIL_STATUSES = [
  "unknown",
  "discovered",
  "verified",
  "risky",
  "invalid",
  "blocked",
] as const
export type GrowthCompanyContactEmailStatus = (typeof GROWTH_COMPANY_CONTACT_EMAIL_STATUSES)[number]

export const GROWTH_COMPANY_CONTACT_PHONE_STATUSES = [
  "unknown",
  "business",
  "mobile",
  "invalid",
  "verified",
] as const
export type GrowthCompanyContactPhoneStatus = (typeof GROWTH_COMPANY_CONTACT_PHONE_STATUSES)[number]

export const GROWTH_COMPANY_CONTACT_SOURCE_TYPES = [
  "website",
  "team_page",
  "contact_page",
  "linkedin",
  "google_business",
  "manual",
  "crm",
  "public_record",
] as const
export type GrowthCompanyContactSourceType = (typeof GROWTH_COMPANY_CONTACT_SOURCE_TYPES)[number]

export const GROWTH_COMPANY_CONTACT_STATUSES = [
  "candidate",
  "verified",
  "suppressed",
  "archived",
] as const
export type GrowthCompanyContactStatus = (typeof GROWTH_COMPANY_CONTACT_STATUSES)[number]

export type GrowthCompanyContactEvidence = {
  claim: string
  evidence: string
  source: string
  page_url?: string | null
}

export type GrowthCompanyContact = {
  id: string
  company_id: string
  growth_lead_id: string | null
  contact_candidate_id: string | null
  lead_decision_maker_id: string | null
  full_name: string
  first_name: string | null
  last_name: string | null
  title: string | null
  department: string | null
  email: string | null
  email_status: GrowthCompanyContactEmailStatus
  phone: string | null
  phone_status: GrowthCompanyContactPhoneStatus
  linkedin_url: string | null
  confidence_score: number
  decision_maker_score: number
  source_type: GrowthCompanyContactSourceType
  source_evidence: GrowthCompanyContactEvidence[]
  contact_status: GrowthCompanyContactStatus
  last_verified_at: string | null
  dedupe_hash: string
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export type GrowthCompanyContactCoverage = {
  coverage_score: number
  coverage_label: "0%" | "25%" | "50%" | "75%" | "100%"
  contact_confidence_score: number
  primary_contact_id: string | null
  recommended_contact_id: string | null
  decision_maker_discovered: boolean
  verified_email: boolean
  verified_phone: boolean
  multiple_contacts: boolean
}

export type GrowthCompanyContactsSnapshot = {
  qa_marker: typeof GROWTH_COMPANY_CONTACTS_QA_MARKER
  schema_ready: boolean
  schema_health?: GrowthSchemaHealthSummary | null
  company_id: string
  contacts: GrowthCompanyContact[]
  coverage: GrowthCompanyContactCoverage
  privacy_note: string
}

export const GROWTH_COMPANY_CONTACTS_PRIVACY_NOTE =
  "Contacts are evidence-backed only — no fabricated emails, phones, or LinkedIn profiles. Verification requires observed or operator-confirmed evidence."

export type DecisionMakerScoreResult = {
  decision_maker_score: number
  confidence_score: number
  confidence_reasoning: string[]
}
