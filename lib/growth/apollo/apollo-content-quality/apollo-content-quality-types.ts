/** Apollo content quality scoring types (Phase 11). */

export const APOLLO_CONTENT_QUALITY_QA_MARKER = "apollo-content-quality-v11" as const

export type ApolloContentChannel = "email" | "sms" | "voice_drop" | "call_plan"

export type ApolloCtaQualityResult = {
  score: number
  specificity: number
  actionability: number
  relevance: number
  meeting_likelihood: number
  is_weak: boolean
  is_generic: boolean
  is_missing: boolean
  issues: string[]
}

export type ApolloSubjectQualityResult = {
  score: number
  personalization: number
  relevance: number
  specificity: number
  curiosity: number
  is_generic: boolean
  is_fallback: boolean
  is_duplicate_risk: boolean
  issues: string[]
}

export type ApolloResearchUtilizationResult = {
  research_utilization_score: number
  sources_available: string[]
  sources_used: string[]
  sources_unused: string[]
  evidence_present: boolean
}

export type ApolloContentQualityBreakdown = Record<string, number>

export type ApolloContentQualityResult = {
  channel: ApolloContentChannel
  quality_score: number
  quality_breakdown: ApolloContentQualityBreakdown
  issues: string[]
}

export type ApolloContentBenchmarkSample = {
  id: string
  channel: ApolloContentChannel
  subject?: string
  body: string
  quality: ApolloContentQualityResult
  opening_fingerprint?: string
  cta_fingerprint?: string
  subject_fingerprint?: string
  research?: ApolloResearchUtilizationResult
}

export type ApolloContentBenchmarkReport = {
  qa_marker: typeof APOLLO_CONTENT_QUALITY_QA_MARKER
  generated_at: string
  counts: {
    emails: number
    sms: number
    voice_drops: number
    call_plans: number
  }
  duplicate_opening_pct: number
  duplicate_subject_pct: number
  duplicate_cta_pct: number
  weak_cta_pct: number
  generic_subject_pct: number
  research_utilization_avg: number
  research_utilization_when_evidence_pct: number
  channel_scores: {
    email: number
    sms: number
    voice_drop: number
    call_plan: number
  }
  weakest_samples: ApolloContentBenchmarkSample[]
  passes_thresholds: boolean
  threshold_notes: string[]
}
