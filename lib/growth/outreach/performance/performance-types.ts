/** Client-safe outreach performance intelligence types (Phase 4.6). */

import type {
  CtaCategory,
  CtaEvidenceSource,
  MemoryOpenerSource,
  MemorySignalKey,
  OutreachContextSourceKey,
  ResearchOpenerSource,
  SubjectCategory,
  SubjectEvidenceSource,
} from "@/lib/growth/outreach/personalization/personalization-types"

export const GROWTH_OUTREACH_PERFORMANCE_QA_MARKER = "growth-outreach-performance-intelligence-v1" as const

export const GROWTH_OUTREACH_PERFORMANCE_PRIVACY_NOTE =
  "Outreach performance intelligence is measurement-only. No autonomous sends, no experiment randomization, no copy changes from metrics."

export const OUTREACH_OPENER_STRATEGY_KEYS = [
  "research_backed",
  "memory_backed",
  "generic",
] as const
export type OutreachOpenerStrategyKey = (typeof OUTREACH_OPENER_STRATEGY_KEYS)[number]

export const OUTREACH_PERFORMANCE_OUTCOME_WINDOW_DAYS = 14 as const

export type OutreachPerformanceAttributionRecord = {
  attributionId: string
  generationId: string | null
  leadId: string | null
  generationType: string
  strategyVersion: string
  variationKey: string
  recordedAt: string
  subjectStrategyKey: string
  subjectCategory: SubjectCategory | string
  subjectEvidenceSource: SubjectEvidenceSource | string
  subjectQualityScore: number | null
  subjectMemoryAware: boolean
  subjectResearchBacked: boolean
  openerStrategyKey: OutreachOpenerStrategyKey
  openerEvidenceSource: string | null
  openerResearchConfidenceTier: "high" | "medium" | null
  openerMemoryBacked: boolean
  openerResearchBacked: boolean
  openerGeneric: boolean
  ctaStrategyKey: string
  ctaCategory: CtaCategory | string
  ctaEvidenceSource: CtaEvidenceSource | string
  ctaQualityScore: number | null
  contextUtilizationPercentage: number | null
  memoryUtilizationPercentage: number | null
  researchConfidence: number | null
  memoryCoverageScore: number | null
  leadEngineGuidanceUsed: boolean
  contextSourcesUsed: OutreachContextSourceKey[]
  memorySignalsUsed: MemorySignalKey[]
}

export type OutreachPerformanceOutcomeFlags = {
  sent: boolean
  replied: boolean
  positiveInterest: boolean
  meetingBooked: boolean
  opportunityCreated: boolean
}

export type OutreachPerformanceAttributedSend = OutreachPerformanceAttributionRecord &
  OutreachPerformanceOutcomeFlags & {
    sentAt: string | null
  }

export type OutreachPerformanceRateMetrics = {
  sends: number
  replies: number
  positiveInterestReplies: number
  meetingsBooked: number
  opportunitiesCreated: number
  replyRate: number | null
  positiveInterestRate: number | null
  meetingRate: number | null
  opportunityConversionRate: number | null
}

export type OutreachPerformanceGroupRow = OutreachPerformanceRateMetrics & {
  groupKey: string
  groupLabel: string
}

export type OutreachPerformanceUtilizationBucketRow = OutreachPerformanceRateMetrics & {
  bucketLabel: string
  bucketMin: number
  bucketMax: number
}

export type OutreachPerformanceExecutiveSummary = OutreachPerformanceRateMetrics & {
  attributedSendCount: number
  measurementWindowDays: number
}

export type OutreachPerformanceDashboard = {
  qa_marker: typeof GROWTH_OUTREACH_PERFORMANCE_QA_MARKER
  generatedAt: string
  measurementWindowDays: number
  executiveSummary: OutreachPerformanceExecutiveSummary
  subjectIntelligence: {
    topPerformers: OutreachPerformanceGroupRow[]
    lowestPerformers: OutreachPerformanceGroupRow[]
    byCategory: OutreachPerformanceGroupRow[]
    byEvidenceSource: OutreachPerformanceGroupRow[]
    memoryAwareVsGeneric: OutreachPerformanceGroupRow[]
    researchBackedVsGeneric: OutreachPerformanceGroupRow[]
  }
  openerIntelligence: {
    topPerformers: OutreachPerformanceGroupRow[]
    lowestPerformers: OutreachPerformanceGroupRow[]
    byStrategy: OutreachPerformanceGroupRow[]
    byEvidenceSource: OutreachPerformanceGroupRow[]
    byResearchConfidenceTier: OutreachPerformanceGroupRow[]
  }
  ctaIntelligence: {
    topPerformers: OutreachPerformanceGroupRow[]
    lowestPerformers: OutreachPerformanceGroupRow[]
    byCategory: OutreachPerformanceGroupRow[]
  }
  personalizationIntelligence: {
    contextUtilizationBuckets: OutreachPerformanceUtilizationBucketRow[]
    memoryUtilizationBuckets: OutreachPerformanceUtilizationBucketRow[]
    researchConfidenceBuckets: OutreachPerformanceUtilizationBucketRow[]
    memoryCoverageBuckets: OutreachPerformanceUtilizationBucketRow[]
    leadEngineGuidanceComparison: OutreachPerformanceGroupRow[]
  }
  dataAudit: {
    availableMetrics: string[]
    missingMetrics: string[]
    attributionLimitations: string[]
  }
}

export type OutreachPerformanceExperimentComparisonKey = {
  comparisonId: string
  dimension: "strategy" | "subject" | "cta" | "personalization"
  armAKey: string
  armBKey: string
  armALabel: string
  armBLabel: string
}

export type OutreachPerformanceExperimentReadiness = {
  qa_marker: typeof GROWTH_OUTREACH_PERFORMANCE_QA_MARKER
  supportedDimensions: Array<"strategy" | "subject" | "cta" | "personalization">
  predefinedComparisons: OutreachPerformanceExperimentComparisonKey[]
  notes: string[]
}
