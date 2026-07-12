/** GE-AIOS-8A-3/8A-4 — Business Intelligence types (client-safe). */

import type { BusinessIntelligenceAiRecommendation } from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
import type { BusinessIntelligenceAiRecommendationsMetadata } from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
import type {
  EvidenceEngineDecisionTier,
  EvidenceEngineLifecycleStatus,
  EvidenceEngineProvider,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

export const GROWTH_BUSINESS_INTELLIGENCE_QA_MARKER = "ge-aios-8a-3-business-intelligence-v1" as const

export const GROWTH_BUSINESS_INTELLIGENCE_PHASE = "GE-AIOS-8A-3" as const

export const GROWTH_BUSINESS_INTELLIGENCE_SCHEMA_MIGRATION =
  "20271002130000_growth_business_intelligence_ge_aios_8a_3.sql" as const

export const BUSINESS_INTELLIGENCE_REPORT_STATUSES = [
  "completed",
  "empty",
  "partial",
  "failed",
] as const

export type BusinessIntelligenceReportStatus = (typeof BUSINESS_INTELLIGENCE_REPORT_STATUSES)[number]

export const BUSINESS_INTELLIGENCE_GAP_SEVERITIES = ["low", "medium", "high"] as const

export type BusinessIntelligenceGapSeverity = (typeof BUSINESS_INTELLIGENCE_GAP_SEVERITIES)[number]

export const BUSINESS_INTELLIGENCE_GAP_CODES = [
  "missing_pricing_evidence",
  "missing_industries_served",
  "missing_testimonials_or_case_studies",
  "missing_geographic_markets",
  "missing_buyer_personas",
  "missing_pain_points",
  "missing_support_channels",
  "company_description_conflict",
  "weak_buyer_persona_evidence",
  "weak_geographic_market_evidence",
  "low_overall_confidence",
  "needs_review_items_present",
  "no_evidence_snapshot",
] as const

export type BusinessIntelligenceGapCode = (typeof BUSINESS_INTELLIGENCE_GAP_CODES)[number]

export type BusinessIntelligenceReportField = {
  value: string | string[] | null
  confidence: number
  supporting_evidence_ids: string[]
  source_providers: EvidenceEngineProvider[]
  decision_tiers: EvidenceEngineDecisionTier[]
  lifecycle_status: EvidenceEngineLifecycleStatus | "unknown"
  needs_review: boolean
  explanation: string
}

export type BusinessIntelligenceCompanyUnderstanding = {
  company_description: BusinessIntelligenceReportField
  primary_offer: BusinessIntelligenceReportField
  products: BusinessIntelligenceReportField
  services: BusinessIntelligenceReportField
  plans_pricing: BusinessIntelligenceReportField
  differentiators: BusinessIntelligenceReportField
  guarantees: BusinessIntelligenceReportField
  support_channels: BusinessIntelligenceReportField
}

export type BusinessIntelligenceMarketUnderstanding = {
  industries_served: BusinessIntelligenceReportField
  geographic_markets: BusinessIntelligenceReportField
  customer_types: BusinessIntelligenceReportField
  company_sizes_served: BusinessIntelligenceReportField
  buyer_terminology: BusinessIntelligenceReportField
  customer_terminology: BusinessIntelligenceReportField
}

export type BusinessIntelligenceProofAndTrust = {
  testimonials: BusinessIntelligenceReportField
  case_studies: BusinessIntelligenceReportField
  certifications: BusinessIntelligenceReportField
  integrations: BusinessIntelligenceReportField
  customer_examples: BusinessIntelligenceReportField
}

export type BusinessIntelligenceSalesGrowthContext = {
  likely_buyer_personas: BusinessIntelligenceReportField
  likely_pain_points: BusinessIntelligenceReportField
  likely_decision_triggers: BusinessIntelligenceReportField
  likely_objections: BusinessIntelligenceReportField
  deal_size_signals: BusinessIntelligenceReportField
  sales_cycle_signals: BusinessIntelligenceReportField
}

export type BusinessIntelligenceReportSections = {
  company: BusinessIntelligenceCompanyUnderstanding
  market: BusinessIntelligenceMarketUnderstanding
  proof_and_trust: BusinessIntelligenceProofAndTrust
  sales_and_growth: BusinessIntelligenceSalesGrowthContext
}

export type BusinessIntelligenceConfidenceSummary = {
  overall_confidence: number
  evidence_strength: number
  freshness_strength: number
  contradiction_count: number
  unknown_count: number
  needs_review_count: number
}

export type BusinessIntelligenceGap = {
  gap_id: string
  gap_code: BusinessIntelligenceGapCode
  severity: BusinessIntelligenceGapSeverity
  title: string
  message: string
  related_fields: string[]
  requires_user_confirmation: boolean
}

export type BusinessIntelligenceContradictionSummary = {
  fact_key: string
  conflicting_values: string[]
  evidence_ids: string[]
  severity: string
  requires_human_review: boolean
}

export type BusinessIntelligenceReport = {
  organization_id: string
  evidence_snapshot_id: string | null
  evidence_run_id: string | null
  generated_at: string
  source_providers: EvidenceEngineProvider[]
  sections: BusinessIntelligenceReportSections
  confidence_summary: BusinessIntelligenceConfidenceSummary
  gaps: BusinessIntelligenceGap[]
  contradictions: BusinessIntelligenceContradictionSummary[]
  contradiction_fact_keys: string[]
  ai_recommendations?: BusinessIntelligenceAiRecommendation[] | null
  ai_recommendations_metadata?: BusinessIntelligenceAiRecommendationsMetadata | null
  metadata: Record<string, unknown>
}

export type BusinessIntelligenceReportRecord = {
  report_id: string
  organization_id: string
  evidence_snapshot_id: string
  evidence_run_id: string
  status: BusinessIntelligenceReportStatus
  generated_at: string
  is_current: boolean
  report: BusinessIntelligenceReport
}

export type RunBusinessIntelligenceInput = {
  organizationId: string
  teammateName?: string | null
  forceRefresh?: boolean
  runEvidenceEngine?: boolean
  websiteUrl?: string | null
  persist?: boolean
  /** Default false — AI recommendations are opt-in. */
  includeAiRecommendations?: boolean
}

export type RunBusinessIntelligenceResult =
  | {
      ok: true
      status: BusinessIntelligenceReportStatus
      organization_id: string
      report: BusinessIntelligenceReport
      report_id?: string | null
      persisted?: boolean
      evidence_snapshot_id?: string | null
      evidence_run_id?: string | null
      empty_state?: false
      ai_recommendations_included?: boolean
    }
  | {
      ok: true
      status: "empty"
      organization_id: string
      empty_state: true
      message: string
      report: null
      report_id?: null
      persisted?: false
    }

export const BUSINESS_INTELLIGENCE_EMPTY_SNAPSHOT_MESSAGE =
  "No Evidence Engine snapshot exists for this organization. Run evidence collection first or set runEvidenceEngine: true." as const
