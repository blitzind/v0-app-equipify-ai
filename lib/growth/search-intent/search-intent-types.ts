/** Growth Engine — Search Intent Signal Engine types (Prompt 19). Client-safe. */

export const GROWTH_SEARCH_INTENT_QA_MARKER = "growth-search-intent-signals-v1" as const

export const GROWTH_SEARCH_INTENT_CATEGORIES = [
  "problem_aware",
  "solution_aware",
  "vendor_comparison",
  "pricing_research",
  "demo_intent",
  "urgent_service_need",
  "competitor_research",
  "local_service_search",
  "industry_research",
] as const

export type GrowthSearchIntentCategory = (typeof GROWTH_SEARCH_INTENT_CATEGORIES)[number]

export const GROWTH_SEARCH_INTENT_STAGES = [
  "awareness",
  "consideration",
  "evaluation",
  "purchase_ready",
  "retention_or_support",
] as const

export type GrowthSearchIntentStage = (typeof GROWTH_SEARCH_INTENT_STAGES)[number]

export const GROWTH_SEARCH_INTENT_SOURCE_TYPES = [
  "organic_search",
  "paid_search",
  "site_search",
  "utm_keyword",
  "referrer_keyword",
  "content_path",
  "manual_import",
  "future_provider",
] as const

export type GrowthSearchIntentSourceType = (typeof GROWTH_SEARCH_INTENT_SOURCE_TYPES)[number]

export const GROWTH_SEARCH_INTENT_STRENGTHS = ["low", "medium", "high"] as const

export type GrowthSearchIntentStrength = (typeof GROWTH_SEARCH_INTENT_STRENGTHS)[number]

export type GrowthSearchIntentAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthSearchIntentCaptureInput = {
  site_key: string
  visitor_key: string
  session_key: string
  lead_inbox_id?: string | null
  company_domain?: string | null
  company_name?: string | null
  landing_page?: string | null
  referrer?: string | null
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  matched_page_path?: string | null
  matched_content_title?: string | null
  keyword?: string | null
  matched_query_pattern?: string | null
  source_type: GrowthSearchIntentSourceType
  source_name?: string | null
  session_count?: number
  visit_count?: number
}

export type GrowthSearchIntentClassifiedSignal = GrowthSearchIntentCaptureInput & {
  normalized_keyword: string
  intent_topic: string
  intent_category: GrowthSearchIntentCategory
  intent_stage: GrowthSearchIntentStage
  intent_strength: GrowthSearchIntentStrength
  intent_score: number
  matched_query_pattern: string | null
  evidence: string
  source_attribution: GrowthSearchIntentAttribution[]
  metadata?: Record<string, unknown>
}

export type GrowthSearchIntentSignalRow = {
  id: string
  created_at: string
  updated_at: string
  site_key: string
  visitor_key: string
  session_key: string
  lead_inbox_id: string | null
  company_domain: string | null
  company_name: string | null
  keyword: string
  normalized_keyword: string
  intent_topic: string
  intent_category: GrowthSearchIntentCategory
  intent_stage: GrowthSearchIntentStage
  intent_strength: GrowthSearchIntentStrength
  intent_score: number
  source_type: GrowthSearchIntentSourceType
  source_name: string | null
  landing_page: string | null
  referrer: string | null
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  matched_page_path: string | null
  matched_content_title: string | null
  matched_query_pattern: string | null
  evidence: string
  source_attribution: GrowthSearchIntentAttribution[]
  metadata: Record<string, unknown>
}

export type GrowthSearchIntentScoreContribution = {
  points: number
  reasons: string[]
  breakdown: Record<string, number>
  top_category: GrowthSearchIntentCategory | null
  top_keyword: string | null
  signal_count: number
  max_confidence: number
}

export type GrowthSearchIntentCaptureResult = {
  qa_marker: typeof GROWTH_SEARCH_INTENT_QA_MARKER
  signals: GrowthSearchIntentClassifiedSignal[]
  contribution: GrowthSearchIntentScoreContribution
}
