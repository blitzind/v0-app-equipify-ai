/** Company confidence intelligence types. Client-safe. */

export const GROWTH_CONFIDENCE_INTELLIGENCE_QA_MARKER = "growth-confidence-intelligence-v1" as const

export type GrowthCompanyConfidenceScore = {
  company_id: string
  discovery_confidence: number
  contact_confidence: number
  signal_confidence: number
  coverage_confidence: number
  freshness_confidence: number
  overall_confidence: number
  evidence: Array<{ dimension: string; score: number; excerpt: string }>
  last_computed_at: string
}

export const GROWTH_CONFIDENCE_INTELLIGENCE_PRIVACY_NOTE =
  "Confidence scores are deterministic and evidence-backed. No fabricated confidence values."
