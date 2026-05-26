/** Intent → Lead Engine bridge types (Prompt 15). Client-safe. */

import type { GrowthIntentPixelConsentStatus } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"
import type {
  GrowthCompanyIdentificationMatchCandidate,
} from "@/lib/growth/company-identification/company-identification-types"
import type {
  GrowthSearchIntentCategory,
  GrowthSearchIntentClassifiedSignal,
} from "@/lib/growth/search-intent/search-intent-types"

export const GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER = "growth-intent-lead-bridge-v1" as const

export const GROWTH_INTENT_CANDIDATE_TYPES = [
  "anonymous",
  "identified",
  "returning",
  "high_intent",
  "existing_account",
] as const

export type GrowthIntentLeadCandidateType = (typeof GROWTH_INTENT_CANDIDATE_TYPES)[number]

export const GROWTH_INTENT_CANDIDATE_GRADES = ["A", "B", "C", "D", "F"] as const

export type GrowthIntentLeadCandidateGrade = (typeof GROWTH_INTENT_CANDIDATE_GRADES)[number]

export const GROWTH_INTENT_CANDIDATE_PRIORITIES = ["urgent", "high", "normal", "low"] as const

export type GrowthIntentLeadCandidatePriority =
  (typeof GROWTH_INTENT_CANDIDATE_PRIORITIES)[number]

export const GROWTH_INTENT_PIPELINE_ENTRY_STAGES = [
  "icp_targeting",
  "company_discovery",
  "contact_research",
] as const

export type GrowthIntentLeadPipelineEntryStage =
  (typeof GROWTH_INTENT_PIPELINE_ENTRY_STAGES)[number]

export type GrowthIntentLeadCandidateEvidence = {
  claim: string
  evidence: string
  source: string
}

export type GrowthIntentLeadCandidateAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthIntentLeadCandidateIdentity = {
  /** Only from explicit identified_contacts — never inferred from pageviews. */
  email: string | null
  phone: string | null
  full_name: string | null
  company_name: string | null
  capture_source: string | null
  identity_rejected: boolean
}

export type GrowthIntentLeadCandidate = {
  qa_marker: typeof GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER
  candidate_id: string
  site_key: string
  visitor_key: string
  session_id: string
  session_key: string
  consent_status: GrowthIntentPixelConsentStatus
  candidate_type: GrowthIntentLeadCandidateType
  candidate_reasoning: string[]
  intent_score: number
  intent_grade: GrowthIntentLeadCandidateGrade
  candidate_confidence: number
  candidate_priority: GrowthIntentLeadCandidatePriority
  lead_engine_eligible: boolean
  recommended_pipeline_entry: GrowthIntentLeadPipelineEntryStage
  dedupe_hash: string
  dedupe_matched: boolean
  dedupe_reason: string | null
  domain: string | null
  identity: GrowthIntentLeadCandidateIdentity
  candidate_evidence: GrowthIntentLeadCandidateEvidence[]
  candidate_attribution: GrowthIntentLeadCandidateAttribution[]
  scoring_breakdown: Record<string, number>
  threshold_passed: boolean
  threshold_reasons: string[]
  warnings: string[]
  search_intent_summary: {
    top_keyword: string | null
    top_category: GrowthSearchIntentCategory | null
    signal_count: number
    max_confidence: number
  } | null
  search_intent_signals: GrowthSearchIntentClassifiedSignal[]
  company_identification_summary: {
    company_name: string | null
    company_domain: string | null
    match_type: string | null
    matched_source: string | null
    match_confidence: number
    match_score: number
    is_candidate_match: boolean
  } | null
  company_identification_matches: GrowthCompanyIdentificationMatchCandidate[]
}

export type GrowthIntentLeadBridgeResult = {
  qa_marker: typeof GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER
  ok: boolean
  site_key: string
  session_id: string
  lead_candidate: GrowthIntentLeadCandidate | null
  pipeline_entry: GrowthLeadEnginePipelineStageId | null
  errors: string[]
  warnings: string[]
}

export type GrowthIntentLeadBridgeBatchResult = {
  qa_marker: typeof GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER
  site_key: string
  candidates: GrowthIntentLeadCandidate[]
  eligible_count: number
  duplicate_count: number
  rejected_count: number
  errors: string[]
}
