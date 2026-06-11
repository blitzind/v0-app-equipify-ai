/** AI Meeting Prep (M1-C) types — client-safe. */

import type { ApolloMeetingBridgeAttributionRecord } from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import type {
  GrowthMeetingPrepBundle,
  MeetingPrepAccountPlaybookContext,
  MeetingPrepDecisionMaker,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"

export const AI_MEETING_PREP_QA_MARKER = "growth-ai-meeting-prep-m1c-v1" as const

export const AI_MEETING_PREP_MIGRATION =
  "20270820120000_growth_engine_ai_meeting_preparations_m1c.sql" as const

export const AI_MEETING_PREP_STATUSES = ["draft", "approved", "rejected", "stale"] as const

export type AiMeetingPrepStatus = (typeof AI_MEETING_PREP_STATUSES)[number]

export type AiMeetingPrepSafetyFlags = {
  outreach_sent: false
  calendar_written: false
  meeting_scheduled: false
  opportunity_created: false
  autonomous_reply_sent: false
}

export type AiMeetingPrepStakeholderAnalysisItem = {
  role_category: string
  contact_name: string | null
  title: string | null
  talking_points: string[]
  messaging_themes: string[]
}

export type AiMeetingPrepAgendaItem = {
  segment: string
  duration_minutes: number
  objective: string
}

export type AiMeetingPrepObjectionItem = {
  objection: string
  response_angle: string
  evidence: string
}

export type AiMeetingPrepGeneratedArtifacts = {
  executive_brief: string
  meeting_objective: string
  suggested_agenda: AiMeetingPrepAgendaItem[]
  stakeholder_analysis: AiMeetingPrepStakeholderAnalysisItem[]
  likely_objections: AiMeetingPrepObjectionItem[]
  discovery_questions: string[]
  competitive_risks: string[]
  recommended_outcome: string
  confidence_score: number
  reasoning: string
}

export type AiMeetingPrepGeneratorInput = {
  meeting_id: string
  prep_bundle: GrowthMeetingPrepBundle
  account_playbook_context?: MeetingPrepAccountPlaybookContext | null
  decision_makers?: MeetingPrepDecisionMaker[]
  conversation_intelligence?: {
    competitor_mentions?: string[]
    competitor_pressure?: number | null
    momentum_summary?: string | null
  }
  reply_intelligence?: {
    intent?: string | null
    confidence?: number | null
    body_preview?: string | null
  }
  opportunity_readiness?: {
    tier?: string | null
    score?: number | null
  }
  meeting_readiness?: {
    score?: number | null
    label?: string | null
  }
}

export type AiMeetingPrepRow = {
  prep_id: string
  meeting_id: string
  lead_id: string
  account_playbook_id: string | null
  meeting_candidate_id: string | null
  source_attribution: ApolloMeetingBridgeAttributionRecord | Record<string, unknown> | null
  executive_brief: string
  meeting_objective: string
  suggested_agenda: AiMeetingPrepAgendaItem[]
  stakeholder_analysis: AiMeetingPrepStakeholderAnalysisItem[]
  likely_objections: AiMeetingPrepObjectionItem[]
  discovery_questions: string[]
  competitive_risks: string[]
  recommended_outcome: string
  confidence_score: number
  reasoning: string
  status: AiMeetingPrepStatus
  input_hash: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  approved_email: string | null
  rejection_note: string | null
}

export type AiMeetingPrepQueueSnapshot = {
  qa_marker: typeof AI_MEETING_PREP_QA_MARKER
  queue_label: "AI Meeting Prep Ready"
  items: AiMeetingPrepRow[]
  summary: {
    total: number
    draft: number
    approved: number
    rejected: number
    stale: number
  }
} & AiMeetingPrepSafetyFlags

export type AiMeetingPrepActionResult = {
  ok: boolean
  action: "generate_ai_meeting_prep" | "approve_ai_meeting_prep" | "reject_ai_meeting_prep" | "regenerate_ai_meeting_prep"
  prep_id: string | null
  status: AiMeetingPrepStatus | null
  artifacts: AiMeetingPrepGeneratedArtifacts | null
  error?: string | null
} & AiMeetingPrepSafetyFlags

export type AiMeetingPrepGenerateResult = {
  ok: boolean
  prep: AiMeetingPrepRow | null
  artifacts: AiMeetingPrepGeneratedArtifacts | null
  error?: string | null
} & AiMeetingPrepSafetyFlags
