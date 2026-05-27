/** Multi-source growth signal types. Client-safe. */

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER = "growth-company-growth-signals-v1" as const

export const GROWTH_EVIDENCE_SOURCE_TYPES = [
  "website",
  "team_page",
  "contact_page",
  "about_page",
  "careers_page",
  "google_business",
  "linkedin_company",
  "press_news",
  "review_site",
  "job_posting",
  "tech_stack",
  "public_record",
  "manual",
] as const
export type GrowthEvidenceSourceType = (typeof GROWTH_EVIDENCE_SOURCE_TYPES)[number]

export const GROWTH_COMPANY_GROWTH_SIGNAL_TYPES = [
  "hiring_technicians",
  "hiring_operations",
  "new_location",
  "expansion",
  "website_rebuild",
  "technology_change",
  "review_spike",
  "negative_review_spike",
  "funding_or_acquisition",
  "service_line_expansion",
  "equipment_specialty_detected",
  "competitor_detected",
  "buying_intent",
  "stale_data",
] as const
export type GrowthCompanyGrowthSignalType = (typeof GROWTH_COMPANY_GROWTH_SIGNAL_TYPES)[number]

export const GROWTH_SIGNAL_TIERS = ["low", "moderate", "high", "urgent"] as const
export type GrowthSignalTier = (typeof GROWTH_SIGNAL_TIERS)[number]

export type GrowthCompanyEvidenceSource = {
  id: string
  company_id: string
  source_type: GrowthEvidenceSourceType
  source_url: string | null
  confidence_score: number
  evidence_excerpt: string
  observed_at: string
  expires_at: string | null
  metadata: Record<string, unknown>
}

export type GrowthCompanyGrowthSignal = {
  id: string
  company_id: string
  signal_type: GrowthCompanyGrowthSignalType
  confidence_score: number
  source_type: GrowthEvidenceSourceType
  source_url: string | null
  evidence_excerpt: string
  detected_at: string
  expires_at: string | null
  metadata: Record<string, unknown>
}

export type GrowthCompanyGrowthSignalScore = {
  company_id: string
  growth_signal_score: number
  signal_tier: GrowthSignalTier
  top_signals: Array<{ signal_type: GrowthCompanyGrowthSignalType; confidence_score: number; evidence_excerpt: string }>
  recommended_next_action: string | null
  last_computed_at: string
}

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export type GrowthCompanyGrowthSignalsSnapshot = {
  qa_marker: typeof GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER
  schema_ready: boolean
  schema_health?: GrowthSchemaHealthSummary | null
  company_id: string
  evidence_sources: GrowthCompanyEvidenceSource[]
  signals: GrowthCompanyGrowthSignal[]
  score: GrowthCompanyGrowthSignalScore | null
  privacy_note: string
}

export const GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE =
  "Growth signals require evidence excerpts from observed sources. No fabricated provider data or autonomous actions."

export type RawGrowthSignalCandidate = {
  signal_type: GrowthCompanyGrowthSignalType
  confidence_score: number
  source_type: GrowthEvidenceSourceType
  source_url: string | null
  evidence_excerpt: string
  expires_at?: string | null
  metadata?: Record<string, unknown>
}

export type RawEvidenceSourceCandidate = {
  source_type: GrowthEvidenceSourceType
  source_url: string | null
  confidence_score: number
  evidence_excerpt: string
  expires_at?: string | null
  metadata?: Record<string, unknown>
}

export const GROWTH_SIGNAL_TYPE_LABELS: Record<GrowthCompanyGrowthSignalType, string> = {
  hiring_technicians: "Hiring technicians",
  hiring_operations: "Hiring operations roles",
  new_location: "New location",
  expansion: "Expansion activity",
  website_rebuild: "Website rebuild",
  technology_change: "Technology change",
  review_spike: "Review spike",
  negative_review_spike: "Negative review trend",
  funding_or_acquisition: "Funding or acquisition",
  service_line_expansion: "Service line expansion",
  equipment_specialty_detected: "Equipment specialty detected",
  competitor_detected: "Competitor detected",
  buying_intent: "Buying intent",
  stale_data: "Stale data",
}
