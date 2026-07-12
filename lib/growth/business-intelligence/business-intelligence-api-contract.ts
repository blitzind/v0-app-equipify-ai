/** GE-AIOS-8A-5 — Business Intelligence read-only API contract (client-safe). */

import type {
  BusinessIntelligenceAiRecommendation,
  BusinessIntelligenceAiRecommendationsMetadata,
} from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
import {
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
  type BusinessIntelligenceLeadDiscoveryContextSlice,
  type BusinessIntelligenceLeadDiscoverySignals,
} from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context-types"
import type {
  BusinessIntelligenceReviewDecisionSummary,
  BusinessIntelligenceReviewProgress,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import {
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
  businessIntelligenceReviewPrompt,
  GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_LABEL,
  reviewDecisionLabel,
  BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS,
  type BusinessIntelligenceReviewDecisionType,
  type BusinessIntelligenceReviewFieldKey,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import type {
  BusinessIntelligenceConfidenceSummary,
  BusinessIntelligenceContradictionSummary,
  BusinessIntelligenceGap,
  BusinessIntelligenceReport,
  BusinessIntelligenceReportStatus,
} from "@/lib/growth/business-intelligence/business-intelligence-types"
import { GROWTH_BUSINESS_INTELLIGENCE_QA_MARKER } from "@/lib/growth/business-intelligence/business-intelligence-types"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER = "ge-aios-8a-5-business-intelligence-ui-v1" as const

export const GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER =
  "ge-aios-8a-6-business-intelligence-research-trigger-v1" as const

export const GROWTH_BUSINESS_INTELLIGENCE_UI_PHASE = "GE-AIOS-8A-5" as const

export const GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_PHASE = "GE-AIOS-8A-6" as const

export { GROWTH_BUSINESS_INTELLIGENCE_QA_MARKER }

export const GROWTH_BUSINESS_INTELLIGENCE_API_PATH =
  "/api/platform/growth/business-intelligence/report" as const

export const GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH =
  "/api/platform/growth/business-intelligence/research" as const

export function growthBusinessIntelligenceResearchSteps(teammate: AiTeammatePresentation): string[] {
  return [
  "Reading website",
  "Finding business facts",
  "Comparing approved profile",
  `Building ${teammate.name}'s understanding`,
  "Preparing recommendations",
  ]
}
export const GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS =
  growthBusinessIntelligenceResearchSteps(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))

export const GROWTH_BUSINESS_INTELLIGENCE_RECENTLY_RESEARCHED_LABEL = "Recently researched" as const

export const GROWTH_BUSINESS_INTELLIGENCE_SECTION_TITLE = "Business Intelligence" as const

export function growthBusinessIntelligenceSectionSubtitle(teammate: AiTeammatePresentation): string {
  return `Here's what ${teammate.name} currently understands about your business.`
}
export const GROWTH_BUSINESS_INTELLIGENCE_SECTION_SUBTITLE =
  growthBusinessIntelligenceSectionSubtitle(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))

export function growthBusinessIntelligenceEmptyMessage(teammate: AiTeammatePresentation): string {
  return `${teammate.name} hasn't researched your business yet.`
}
export const GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE =
  growthBusinessIntelligenceEmptyMessage(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))

export const GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL = "Research my company" as const

export const GROWTH_BUSINESS_INTELLIGENCE_READ_ONLY_BANNER =
  "Read-only — no crawl, AI synthesis, or profile changes from this view." as const

export type BusinessIntelligenceEvidenceSummary = {
  evidence_id: string
  provider: string
  source_url: string | null
  page_title: string | null
  confidence: number
  decision_tier: string
  lifecycle_status: string
  raw_excerpt: string | null
}

export type GrowthBusinessIntelligenceReportPayload = {
  report_id: string | null
  status: BusinessIntelligenceReportStatus
  generated_at: string | null
  evidence_snapshot_id: string | null
  evidence_run_id: string | null
  report: BusinessIntelligenceReport | null
  confidence_summary: BusinessIntelligenceConfidenceSummary | null
  gaps: BusinessIntelligenceGap[]
  contradictions: BusinessIntelligenceContradictionSummary[]
  ai_recommendations: BusinessIntelligenceAiRecommendation[] | null
  ai_recommendations_metadata: BusinessIntelligenceAiRecommendationsMetadata | null
  evidence_by_id: Record<string, BusinessIntelligenceEvidenceSummary>
  review_decisions?: Record<string, BusinessIntelligenceReviewDecisionSummary>
  review_progress?: BusinessIntelligenceReviewProgress
}

export type GrowthBusinessIntelligenceReportApiResponse = {
  ok: boolean
  qa_marker: typeof GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER
  schemaReady?: boolean
  empty_state?: boolean
  message?: string
  payload?: GrowthBusinessIntelligenceReportPayload
}

export type GrowthBusinessIntelligenceResearchRequest = {
  forceRefresh?: boolean
  websiteUrl?: string | null
}

export type GrowthBusinessIntelligenceResearchApiResponse = {
  ok: boolean
  qa_marker: typeof GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER
  cached?: boolean
  recently_researched?: boolean
  message?: string
  payload?: GrowthBusinessIntelligenceReportPayload
}

export const GROWTH_BUSINESS_INTELLIGENCE_REVIEW_DECISION_API_PATH =
  "/api/platform/growth/business-intelligence/review-decision" as const

export const GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_API_PATH =
  "/api/platform/growth/business-intelligence/apply-to-business-profile" as const

export type GrowthBusinessIntelligenceReviewDecisionRequest = {
  fieldKey: string
  decision: "approved" | "edited" | "dismissed" | "marked_unknown" | "needs_more_info"
  approvedValue?: string | string[] | null
}

export type GrowthBusinessIntelligenceReviewDecisionApiResponse = {
  ok: boolean
  qa_marker: typeof GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER
  message?: string
  decision?: BusinessIntelligenceReviewDecisionSummary
  review_progress?: BusinessIntelligenceReviewProgress
}

export type GrowthBusinessIntelligenceApplyToProfileApiResponse = {
  ok: boolean
  qa_marker: typeof GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER
  message?: string
  profileId?: string
  created?: boolean
}

export {
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_PHASE,
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY,
  GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY,
  type BusinessIntelligenceLeadDiscoverySignals,
  type BusinessIntelligenceLeadDiscoveryContextSlice,
} from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context-types"

export type GrowthBusinessIntelligenceLeadDiscoveryContextApiResponse = {
  ok: boolean
  qa_marker: typeof GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER
  message?: string
  signals?: BusinessIntelligenceLeadDiscoverySignals | null
}

export {
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
  businessIntelligenceReviewPrompt,
  GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_LABEL,
  reviewDecisionLabel,
  BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS,
  type BusinessIntelligenceReviewDecisionType,
  type BusinessIntelligenceReviewFieldKey,
}

export function growthBusinessIntelligenceReportHref(includeAiRecommendations = true): string {
  const params = new URLSearchParams()
  if (includeAiRecommendations) {
    params.set("includeAiRecommendations", "true")
  }
  const query = params.toString()
  return query ? `${GROWTH_BUSINESS_INTELLIGENCE_API_PATH}?${query}` : GROWTH_BUSINESS_INTELLIGENCE_API_PATH
}
