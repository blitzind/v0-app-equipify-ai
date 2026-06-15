/** Phase GS-2D — Signal-aware prospect recommendation types (client-safe). */

import type { SignalRecommendationPriority } from "@/lib/growth/signal-intelligence/signal-feed-types"

export const PROSPECT_RECOMMENDATION_QA_MARKER = "growth-prospect-recommendations-gs2d-v1" as const

export const PROSPECT_RECOMMENDATION_CONFIRM = "RUN_PROSPECT_RECOMMENDATIONS_CERTIFICATION" as const

export const PROSPECT_RECOMMENDATION_TYPES = [
  "review_company",
  "run_company_intelligence",
  "run_buying_committee_expansion",
  "enroll_sequence",
  "schedule_call",
  "review_signal_activity",
  "research_competitor",
] as const

export type ProspectRecommendationType = (typeof PROSPECT_RECOMMENDATION_TYPES)[number]

export const PROSPECT_RECOMMENDATION_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const

export type ProspectRecommendationPriority = SignalRecommendationPriority

export const PROSPECT_RECOMMENDATION_STATUSES = ["new", "viewed", "acted_on", "dismissed"] as const
export type ProspectRecommendationStatus = (typeof PROSPECT_RECOMMENDATION_STATUSES)[number]

export const PROSPECT_RECOMMENDATION_FILTERS = PROSPECT_RECOMMENDATION_PRIORITIES
export type ProspectRecommendationFilter = ProspectRecommendationPriority

export const PROSPECT_RECOMMENDATION_SORT_FIELDS = [
  "priority",
  "confidence",
  "estimated_revenue_impact",
] as const
export type ProspectRecommendationSortField = (typeof PROSPECT_RECOMMENDATION_SORT_FIELDS)[number]

export const PROSPECT_RECOMMENDATION_ACTIONS = ["mark_viewed", "mark_acted_on", "dismiss"] as const
export type ProspectRecommendationActionType = (typeof PROSPECT_RECOMMENDATION_ACTIONS)[number]

export type ProspectEstimatedRevenueImpact = {
  level: "low" | "moderate" | "high" | "very_high"
  summary: string
  sort_score: number
}

export type ProspectRecommendation = {
  qa_marker: typeof PROSPECT_RECOMMENDATION_QA_MARKER
  recommendation_id: string
  audit_event_id?: string | null
  execution_run_id: string
  lead_id: string | null
  company_id: string
  company_name: string
  recommendation_type: ProspectRecommendationType
  priority: ProspectRecommendationPriority
  confidence: number
  reasoning: string[]
  signals: string[]
  qualification_score: number
  engagement_score: number
  opportunity_score: number
  estimated_revenue_impact: ProspectEstimatedRevenueImpact
  recommended_actions: string[]
  status: ProspectRecommendationStatus
  dedupe_hash: string
  collapsed_count: number
  created_at: string
  requires_human_approval: true
  enrollment_enabled: false
  outreach_enabled: false
}

export type TopProspectOpportunityCard = {
  qa_marker: typeof PROSPECT_RECOMMENDATION_QA_MARKER
  recommendation_id: string
  audit_event_id: string
  execution_run_id: string
  company_id: string
  company_name: string
  lead_id: string | null
  signals: string[]
  primary_recommendation: string
  recommendation_type: ProspectRecommendationType
  priority: ProspectRecommendationPriority
  confidence: number
  estimated_revenue_impact: string
  estimated_revenue_impact_level: ProspectEstimatedRevenueImpact["level"]
  recommended_actions: string[]
  status: ProspectRecommendationStatus
  collapsed_count: number
  cta: {
    review_company: string | null
    view_signals: string | null
    review_sequence: string | null
  }
  requires_human_approval: true
  enrollment_enabled: false
  outreach_enabled: false
}

export type GrowthProspectRecommendationsResponse = {
  qa_marker: typeof PROSPECT_RECOMMENDATION_QA_MARKER
  generated_at: string
  total: number
  collapsed_from: number
  items: ProspectRecommendation[]
  top_opportunities: TopProspectOpportunityCard[]
  enrollment_enabled: false
  outreach_enabled: false
  requires_human_approval: true
}

export type ProspectPriorityScoreInput = {
  signals: string[]
  qualification_score: number
  engagement_score: number
  opportunity_score: number
  company_intelligence_score: number
  hiring_signal_strength: number
  funding_signal_strength: number
  website_intent_strength: number
  company_size_score: number
  account_playbook_fit: number
  decision_maker_availability: number
  signal_activity_score: number
}

export type ProspectPriorityScoreResult = {
  score: number
  priority: ProspectRecommendationPriority
  confidence: number
  factors: string[]
}

export const PROSPECT_RECOMMENDATION_TYPE_LABELS: Record<ProspectRecommendationType, string> = {
  review_company: "Review Company",
  run_company_intelligence: "Run Company Intelligence",
  run_buying_committee_expansion: "Review Buying Committee",
  enroll_sequence: "Recommend Executive Outreach Sequence",
  schedule_call: "Schedule Call",
  review_signal_activity: "Review Signal Activity",
  research_competitor: "Research Competitor",
}
