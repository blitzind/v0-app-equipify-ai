/** Growth Engine — Lead Inbox + Candidate Queue types (Prompt 16). Client-safe where noted. */

import type {
  GrowthIntentLeadCandidateAttribution,
  GrowthIntentLeadCandidateEvidence,
  GrowthIntentLeadCandidatePriority,
  GrowthIntentLeadCandidateType,
  GrowthIntentLeadPipelineEntryStage,
} from "@/lib/growth/lead-engine/intent/intent-candidate-types"

export const GROWTH_LEAD_INBOX_QA_MARKER = "growth-lead-inbox-v1" as const

export const GROWTH_LEAD_INBOX_STATUSES = [
  "new",
  "reviewing",
  "approved",
  "enriching",
  "running_pipeline",
  "pipeline_complete",
  "disqualified",
  "duplicate",
  "archived",
] as const

export type GrowthLeadInboxStatus = (typeof GROWTH_LEAD_INBOX_STATUSES)[number]

export const GROWTH_LEAD_INBOX_PIPELINE_STATUSES = [
  "not_started",
  "queued",
  "running",
  "completed",
  "failed",
] as const

export type GrowthLeadInboxPipelineStatus =
  (typeof GROWTH_LEAD_INBOX_PIPELINE_STATUSES)[number]

export type GrowthLeadInboxCrmMatch = {
  matched: boolean
  source: string | null
  ids: string[]
  evidence: string
}

export type GrowthLeadInboxRow = {
  id: string
  created_at: string
  updated_at: string
  site_key: string
  candidate_type: GrowthIntentLeadCandidateType
  candidate_priority: GrowthIntentLeadCandidatePriority
  intent_score: number
  intent_grade: string
  candidate_confidence: number
  pipeline_entry: GrowthIntentLeadPipelineEntryStage
  pipeline_status: GrowthLeadInboxPipelineStatus
  company_name: string
  domain: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  dedupe_hash: string
  candidate_reasoning: string[]
  candidate_evidence: GrowthIntentLeadCandidateEvidence[]
  candidate_attribution: GrowthIntentLeadCandidateAttribution[]
  session_count: number
  visit_count: number
  utm_source: string
  utm_medium: string
  utm_campaign: string
  owner_id: string | null
  status: GrowthLeadInboxStatus
  human_review_required: boolean
  lead_engine_run_id: string | null
  intent_session_id: string
  visitor_key: string
  existing_account_match: GrowthLeadInboxCrmMatch
  existing_lead_match: GrowthLeadInboxCrmMatch
  metadata: Record<string, unknown>
}

export type GrowthLeadInboxCreateInput = {
  site_key: string
  candidate_type: GrowthIntentLeadCandidateType
  candidate_priority: GrowthIntentLeadCandidatePriority
  intent_score: number
  intent_grade: string
  candidate_confidence: number
  pipeline_entry: GrowthIntentLeadPipelineEntryStage
  company_name?: string
  domain?: string | null
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  dedupe_hash: string
  candidate_reasoning: string[]
  candidate_evidence: GrowthIntentLeadCandidateEvidence[]
  candidate_attribution: GrowthIntentLeadCandidateAttribution[]
  session_count: number
  visit_count: number
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  intent_session_id: string
  visitor_key: string
  existing_account_match?: GrowthLeadInboxCrmMatch
  existing_lead_match?: GrowthLeadInboxCrmMatch
  human_review_required?: boolean
  metadata?: Record<string, unknown>
}

export type GrowthLeadInboxLoadFilters = {
  status?: GrowthLeadInboxStatus | GrowthLeadInboxStatus[]
  owner_id?: string | null
  candidate_priority?: GrowthIntentLeadCandidatePriority
  pipeline_status?: GrowthLeadInboxPipelineStatus
  limit?: number
  offset?: number
}

export type GrowthLeadInboxLoadResult = {
  qa_marker: typeof GROWTH_LEAD_INBOX_QA_MARKER
  items: GrowthLeadInboxRow[]
  total: number
}

export type GrowthLeadInboxCreateResult = {
  qa_marker: typeof GROWTH_LEAD_INBOX_QA_MARKER
  ok: boolean
  row: GrowthLeadInboxRow | null
  duplicate: boolean
  reason: string
  errors: string[]
}
