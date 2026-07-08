/** Growth Engine — Buying Stage Detection Engine types (Prompt 21). Client-safe. */

export const GROWTH_BUYING_STAGE_QA_MARKER = "growth-buying-stage-engine-v1" as const

export const GROWTH_BUYING_STAGES = [
  "awareness",
  "problem_identified",
  "solution_research",
  "vendor_evaluation",
  "comparison",
  "purchase_ready",
  "active_opportunity",
  "existing_customer_expansion",
  "retention_risk",
] as const

export type GrowthBuyingStage = (typeof GROWTH_BUYING_STAGES)[number]

export const GROWTH_BUYING_STAGE_SIGNAL_TYPES = [
  "search_intent",
  "pricing_demo_contact_pages",
  "repeat_sessions",
  "return_frequency",
  "session_depth",
  "operator_activity",
  "existing_account_relationship",
  "high_intent_actions",
  "comparison_behavior",
  "content_patterns",
  "company_identification_confidence",
  "intent_score",
] as const

export type GrowthBuyingStageSignalType = (typeof GROWTH_BUYING_STAGE_SIGNAL_TYPES)[number]

export type GrowthBuyingStageAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthBuyingStageSignal = {
  signal_type: GrowthBuyingStageSignalType
  label: string
  evidence: string
  source_attribution: GrowthBuyingStageAttribution[]
  weight: number
  stage_hints: Partial<Record<GrowthBuyingStage, number>>
  metadata?: Record<string, unknown>
}

export type GrowthBuyingStageInput = {
  site_key: string
  visitor_key: string
  session_key: string
  intent_session_id?: string | null
  growth_lead_id?: string | null
  company_identification_id?: string | null
  intent_score: number
  session_count: number
  visit_count: number
  unique_page_count: number
  total_time_on_site_ms: number
  high_intent_path_hits: string[]
  conversion_types: string[]
  has_identified_contact: boolean
  existing_customer_ids: string[]
  existing_lead_ids: string[]
  search_intent_top_category: string | null
  search_intent_signal_count: number
  search_intent_max_confidence: number
  company_match_confidence: number
  company_matched_source: string | null
  operator_activity_count: number
}

export type GrowthBuyingStageAssessmentCandidate = {
  detected_stage: GrowthBuyingStage
  stage_confidence: number
  stage_score: number
  stage_reasoning: string[]
  evidence: string
  source_attribution: GrowthBuyingStageAttribution[]
  signal_summary: GrowthBuyingStageSignal[]
  metadata?: Record<string, unknown>
}

export type GrowthBuyingStageResult = {
  qa_marker: typeof GROWTH_BUYING_STAGE_QA_MARKER
  assessment: GrowthBuyingStageAssessmentCandidate | null
  is_candidate_assessment: boolean
  summary: {
    detected_stage: GrowthBuyingStage | null
    stage_confidence: number
    stage_score: number
    signal_count: number
  } | null
}

export type GrowthBuyingStageScoreContribution = {
  points: number
  reasons: string[]
  breakdown: Record<string, number>
  confidence_boost: number
}

export type GrowthBuyingStageAssessmentRow = {
  id: string
  created_at: string
  updated_at: string
  growth_lead_id: string | null
  intent_session_id: string | null
  company_identification_id: string | null
  detected_stage: GrowthBuyingStage
  stage_confidence: number
  stage_score: number
  stage_reasoning: string[]
  evidence: string
  source_attribution: GrowthBuyingStageAttribution[]
  signal_summary: GrowthBuyingStageSignal[]
  metadata: Record<string, unknown>
}
