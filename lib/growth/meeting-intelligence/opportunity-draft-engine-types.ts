/** Opportunity Draft Engine (M1-D) types — client-safe. */

import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import type { MeetingOutcomeIntelligenceScorePublicView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type {
  GrowthMeetingPrepBundle,
  MeetingPrepAccountPlaybookContext,
  MeetingPrepDecisionMaker,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"

export const OPPORTUNITY_DRAFT_ENGINE_QA_MARKER = "growth-opportunity-draft-engine-m1d-v1" as const

export const OPPORTUNITY_DRAFT_ENGINE_ID = "growth-opportunity-draft-engine-m1d-v1" as const

export const OPPORTUNITY_DRAFT_ENGINE_MIGRATION =
  "20270821120000_growth_engine_opportunity_drafts_m1d.sql" as const

export const OPPORTUNITY_DRAFT_STATUSES = ["draft", "approved", "rejected", "stale"] as const

export type OpportunityDraftStatus = (typeof OPPORTUNITY_DRAFT_STATUSES)[number]

export const OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
  "Reply Intelligence",
  "Meeting Candidate",
  "Meeting",
  "Opportunity Draft",
] as const

export type OpportunityDraftSourceAttribution = (typeof OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION)[number]

export type OpportunityDraftAttributionRecord = {
  apollo_source: string
  qualification_source: string
  enrollment_source: string
  account_playbook_source: string
  voice_drop_source: string
  multichannel_source: string
  sequence_execution_source: string
  reply_intelligence_source: string
  meeting_candidate_source: string
  meeting_source: string
  opportunity_draft_source: string
  attribution_chain: OpportunityDraftSourceAttribution[]
}

export type OpportunityDraftReadinessStatus = "Weak" | "Developing" | "Qualified" | "Opportunity Ready"

export type OpportunityDraftReadinessResult = {
  opportunity_readiness_score: number
  readiness_status: OpportunityDraftReadinessStatus
  factors: string[]
}

export type OpportunityDraftStakeholder = {
  name: string
  title: string | null
  role_category: string | null
  influence: "primary" | "committee" | "unknown"
}

export type OpportunityDraftGeneratedArtifacts = {
  opportunity_summary: string
  opportunity_type: string
  estimated_value: number
  confidence_score: number
  recommended_stage: GrowthOpportunityStageKey
  key_stakeholders: OpportunityDraftStakeholder[]
  buying_signals: string[]
  risks: string[]
  next_steps: string[]
  reasoning: string
  opportunity_readiness: OpportunityDraftReadinessResult
}

export type OpportunityDraftGeneratorInput = {
  meeting: GrowthMeeting
  meeting_outcome_intelligence?: MeetingOutcomeIntelligenceScorePublicView | null
  meeting_notes?: string | null
  meeting_readiness?: GrowthMeetingPrepBundle["readiness"] | null
  account_playbook_context?: MeetingPrepAccountPlaybookContext | null
  qualification?: {
    score?: number | null
    tier?: string | null
  }
  conversation_intelligence?: {
    competitor_mentions?: string[]
    competitor_pressure?: number | null
    momentum_summary?: string | null
  }
  reply_intelligence?: {
    intent?: string | null
    priority?: string | null
    body_preview?: string | null
  }
  decision_makers?: MeetingPrepDecisionMaker[]
}

export type OpportunityDraftSafetyFlags = {
  opportunity_created: false
  crm_written: false
  deal_created: false
  calendar_written: false
}

export type OpportunityDraftRow = {
  draft_id: string
  meeting_id: string
  lead_id: string
  company_id: string | null
  account_playbook_id: string | null
  company_name: string
  opportunity_summary: string
  opportunity_type: string
  estimated_value: number
  confidence_score: number
  recommended_stage: GrowthOpportunityStageKey
  key_stakeholders: OpportunityDraftStakeholder[]
  buying_signals: string[]
  risks: string[]
  next_steps: string[]
  reasoning: string
  opportunity_readiness_score: number
  opportunity_readiness_status: OpportunityDraftReadinessStatus
  source_attribution: OpportunityDraftAttributionRecord | Record<string, unknown> | null
  status: OpportunityDraftStatus
  input_hash: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  approved_email: string | null
  rejection_note: string | null
}

export type OpportunityDraftQueueSnapshot = {
  qa_marker: typeof OPPORTUNITY_DRAFT_ENGINE_QA_MARKER
  queue_label: "Opportunity Drafts Ready"
  items: OpportunityDraftRow[]
  summary: {
    total: number
    draft: number
    approved: number
    rejected: number
    stale: number
  }
} & OpportunityDraftSafetyFlags

export type OpportunityDraftActionResult = {
  ok: boolean
  action:
    | "generate_opportunity_draft"
    | "approve_opportunity_draft"
    | "reject_opportunity_draft"
    | "regenerate_opportunity_draft"
  draft_id: string | null
  status: OpportunityDraftStatus | null
  artifacts: OpportunityDraftGeneratedArtifacts | null
  error?: string | null
} & OpportunityDraftSafetyFlags

export type OpportunityDraftFunnelMetrics = {
  qa_marker: typeof OPPORTUNITY_DRAFT_ENGINE_QA_MARKER
  meetings_completed: number
  drafts_generated: number
  drafts_approved: number
  drafts_rejected: number
  average_readiness_score: number
  average_confidence_score: number
  average_estimated_value: number
  computed_at: string
}

export type OpportunityDraftEngineCertificationReport = {
  qa_marker: typeof OPPORTUNITY_DRAFT_ENGINE_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  funnel_metrics: OpportunityDraftFunnelMetrics | null
} & OpportunityDraftSafetyFlags

export type OpportunityDraftEngineAutomationReport = {
  qa_marker: typeof OPPORTUNITY_DRAFT_ENGINE_QA_MARKER
  automation_id: typeof OPPORTUNITY_DRAFT_ENGINE_ID
  execution_id: string
  meeting_id: string | null
  drafts_created: number
  drafts_skipped_duplicate: number
  funnel_metrics: OpportunityDraftFunnelMetrics
  blockers: string[]
  completed_at: string
} & OpportunityDraftSafetyFlags
