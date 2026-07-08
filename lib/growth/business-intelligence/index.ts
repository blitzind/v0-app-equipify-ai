/** GE-AIOS-8A-3 — Business Intelligence exports (client-safe types and builders). */

export {
  GROWTH_BUSINESS_INTELLIGENCE_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_PHASE,
  GROWTH_BUSINESS_INTELLIGENCE_SCHEMA_MIGRATION,
  BUSINESS_INTELLIGENCE_REPORT_STATUSES,
  BUSINESS_INTELLIGENCE_GAP_SEVERITIES,
  BUSINESS_INTELLIGENCE_GAP_CODES,
  BUSINESS_INTELLIGENCE_EMPTY_SNAPSHOT_MESSAGE,
  type BusinessIntelligenceReportStatus,
  type BusinessIntelligenceGapSeverity,
  type BusinessIntelligenceGapCode,
  type BusinessIntelligenceReportField,
  type BusinessIntelligenceCompanyUnderstanding,
  type BusinessIntelligenceMarketUnderstanding,
  type BusinessIntelligenceProofAndTrust,
  type BusinessIntelligenceSalesGrowthContext,
  type BusinessIntelligenceReportSections,
  type BusinessIntelligenceConfidenceSummary,
  type BusinessIntelligenceGap,
  type BusinessIntelligenceReport,
  type BusinessIntelligenceReportRecord,
  type RunBusinessIntelligenceInput,
  type RunBusinessIntelligenceResult,
} from "@/lib/growth/business-intelligence/business-intelligence-types"

export {
  BUSINESS_INTELLIGENCE_FIELD_SPECS,
  mapSnapshotToBusinessIntelligenceFields,
  isUnknownField,
  isWeakField,
  fieldHasOnlyWeakWebsiteEvidence,
  type BusinessIntelligenceFactMappingSpec,
} from "@/lib/growth/business-intelligence/business-intelligence-fact-mapper"

export {
  buildBusinessIntelligenceReport,
  detectBusinessIntelligenceGaps,
} from "@/lib/growth/business-intelligence/business-intelligence-report-builder"

export {
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_PHASE,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS,
  GROWTH_BUSINESS_INTELLIGENCE_RECENTLY_RESEARCHED_LABEL,
  type GrowthBusinessIntelligenceResearchApiResponse,
  type GrowthBusinessIntelligenceResearchRequest,
  GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_UI_PHASE,
  GROWTH_BUSINESS_INTELLIGENCE_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_SECTION_TITLE,
  GROWTH_BUSINESS_INTELLIGENCE_SECTION_SUBTITLE,
  GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL,
  GROWTH_BUSINESS_INTELLIGENCE_READ_ONLY_BANNER,
  growthBusinessIntelligenceReportHref,
  type GrowthBusinessIntelligenceReportApiResponse,
  type GrowthBusinessIntelligenceReportPayload,
  type BusinessIntelligenceEvidenceSummary,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_DECISION_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_API_PATH,
  type GrowthBusinessIntelligenceReviewDecisionApiResponse,
  type GrowthBusinessIntelligenceApplyToProfileApiResponse,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"

export {
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_PHASE,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_SCHEMA_MIGRATION,
  BUSINESS_INTELLIGENCE_REVIEW_DECISIONS,
  BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_PROMPT,
  GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_LABEL,
  reviewDecisionLabel,
  isBusinessIntelligenceReviewFieldKey,
  type BusinessIntelligenceReviewDecisionType,
  type BusinessIntelligenceReviewFieldKey,
  type BusinessIntelligenceReviewDecisionRecord,
  type BusinessIntelligenceReviewDecisionSummary,
  type BusinessIntelligenceReviewProgress,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"

export {
  GROWTH_BUSINESS_INTELLIGENCE_AI_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_AI_PHASE,
  BUSINESS_INTELLIGENCE_AI_RECOMMENDATION_CATEGORIES,
  BUSINESS_INTELLIGENCE_AI_LOW_CONFIDENCE_THRESHOLD,
  businessIntelligenceAiModelSchema,
  validateRecommendationEvidencePolicy,
  validateAndSanitizeBusinessIntelligenceAiModel,
  recommendationHasEvidenceOrGapReference,
  type BusinessIntelligenceAiRecommendation,
  type BusinessIntelligenceAiRecommendationCategory,
  type BusinessIntelligenceAiContextPayload,
} from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
