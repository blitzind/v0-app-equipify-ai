/** Growth Engine — Company Identification Engine types (Prompt 20). Client-safe. */

export const GROWTH_COMPANY_IDENTIFICATION_QA_MARKER = "growth-company-identification-v1" as const

export const GROWTH_COMPANY_IDENTIFICATION_MATCH_SOURCES = [
  "email_domain",
  "submitted_identity",
  "utm_domain",
  "referrer_domain",
  "landing_page_domain",
  "company_domain_parameter",
  "crm_customer",
  "crm_prospect",
  "growth_lead",
  "intent_history",
  "future_provider",
] as const

export type GrowthCompanyIdentificationMatchSource =
  (typeof GROWTH_COMPANY_IDENTIFICATION_MATCH_SOURCES)[number]

export const GROWTH_COMPANY_IDENTIFICATION_MATCH_TYPES = [
  "exact_domain",
  "normalized_domain",
  "email_domain",
  "crm_match",
  "submitted_company",
  "inferred_company",
  "future_enrichment",
] as const

export type GrowthCompanyIdentificationMatchType =
  (typeof GROWTH_COMPANY_IDENTIFICATION_MATCH_TYPES)[number]

export type GrowthCompanyIdentificationAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthCompanyIdentificationInput = {
  site_key: string
  visitor_key: string
  session_key: string
  intent_session_id?: string | null
  lead_inbox_id?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
  company_domain?: string | null
  landing_page?: string | null
  referrer?: string | null
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  submitted_company_name?: string | null
}

export type GrowthCompanyIdentificationMatchCandidate = {
  company_name: string
  company_domain: string | null
  matched_customer_id: string | null
  matched_prospect_id: string | null
  matched_growth_lead_id: string | null
  matched_source: GrowthCompanyIdentificationMatchSource
  match_type: GrowthCompanyIdentificationMatchType
  match_confidence: number
  match_score: number
  match_reasoning: string[]
  evidence: string
  source_attribution: GrowthCompanyIdentificationAttribution[]
  metadata?: Record<string, unknown>
}

export type GrowthCompanyIdentificationResult = {
  qa_marker: typeof GROWTH_COMPANY_IDENTIFICATION_QA_MARKER
  matches: GrowthCompanyIdentificationMatchCandidate[]
  top_match: GrowthCompanyIdentificationMatchCandidate | null
  is_candidate_match: boolean
  summary: {
    company_name: string | null
    company_domain: string | null
    match_type: GrowthCompanyIdentificationMatchType | null
    matched_source: GrowthCompanyIdentificationMatchSource | null
    match_confidence: number
    match_score: number
  } | null
}

export type GrowthCompanyIdentificationScoreContribution = {
  points: number
  reasons: string[]
  breakdown: Record<string, number>
  confidence_boost: number
}

export type GrowthCompanyIdentificationMatchRow = {
  id: string
  created_at: string
  updated_at: string
  site_key: string
  visitor_key: string
  session_key: string
  lead_inbox_id: string | null
  intent_session_id: string | null
  company_name: string
  company_domain: string | null
  matched_customer_id: string | null
  matched_prospect_id: string | null
  matched_growth_lead_id: string | null
  matched_source: GrowthCompanyIdentificationMatchSource
  match_type: GrowthCompanyIdentificationMatchType
  match_confidence: number
  match_score: number
  match_reasoning: string[]
  evidence: string
  source_attribution: GrowthCompanyIdentificationAttribution[]
  metadata: Record<string, unknown>
}
