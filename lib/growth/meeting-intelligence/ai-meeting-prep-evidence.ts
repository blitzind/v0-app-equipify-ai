/** AI Meeting Prep evidence helpers — client-safe. */

import type {
  AiMeetingPrepGeneratedArtifacts,
  AiMeetingPrepQueueSnapshot,
  AiMeetingPrepRow,
  AiMeetingPrepSafetyFlags,
  AiMeetingPrepStatus,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { AI_MEETING_PREP_QA_MARKER } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"

export const AI_MEETING_PREP_SAFETY_FLAGS: AiMeetingPrepSafetyFlags = {
  outreach_sent: false,
  calendar_written: false,
  meeting_scheduled: false,
  opportunity_created: false,
  autonomous_reply_sent: false,
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function evaluateAiMeetingPrepApprovalGate(input: {
  prep: AiMeetingPrepRow
}): { allowed: boolean; code: string | null } {
  if (input.prep.status !== "draft") {
    return { allowed: false, code: "invalid_prep_status" }
  }
  if (!input.prep.executive_brief.trim()) {
    return { allowed: false, code: "executive_brief_missing" }
  }
  return { allowed: true, code: null }
}

export function mapAiMeetingPrepDbRow(row: Record<string, unknown>): AiMeetingPrepRow {
  const suggestedAgenda = Array.isArray(row.suggested_agenda)
    ? (row.suggested_agenda as AiMeetingPrepRow["suggested_agenda"])
    : []
  const stakeholderAnalysis = Array.isArray(row.stakeholder_analysis)
    ? (row.stakeholder_analysis as AiMeetingPrepRow["stakeholder_analysis"])
    : []
  const likelyObjections = Array.isArray(row.likely_objections)
    ? (row.likely_objections as AiMeetingPrepRow["likely_objections"])
    : []
  const discoveryQuestions = Array.isArray(row.discovery_questions)
    ? row.discovery_questions.filter((entry): entry is string => typeof entry === "string")
    : []
  const competitiveRisks = Array.isArray(row.competitive_risks)
    ? row.competitive_risks.filter((entry): entry is string => typeof entry === "string")
    : []

  return {
    prep_id: asString(row.id),
    meeting_id: asString(row.meeting_id),
    lead_id: asString(row.lead_id),
    account_playbook_id: asString(row.account_playbook_id) || null,
    meeting_candidate_id: asString(row.meeting_candidate_id) || null,
    source_attribution:
      row.source_attribution && typeof row.source_attribution === "object"
        ? (row.source_attribution as AiMeetingPrepRow["source_attribution"])
        : null,
    executive_brief: asString(row.executive_brief),
    meeting_objective: asString(row.meeting_objective),
    suggested_agenda: suggestedAgenda,
    stakeholder_analysis: stakeholderAnalysis,
    likely_objections: likelyObjections,
    discovery_questions: discoveryQuestions,
    competitive_risks: competitiveRisks,
    recommended_outcome: asString(row.recommended_outcome),
    confidence_score: asNumber(row.confidence_score),
    reasoning: asString(row.reasoning),
    status: (asString(row.status) || "draft") as AiMeetingPrepStatus,
    input_hash: asString(row.input_hash) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    approved_at: asString(row.approved_at) || null,
    approved_email: asString(row.approved_email) || null,
    rejection_note: asString(row.rejection_note) || null,
  }
}

export function buildAiMeetingPrepQueueSnapshot(input: {
  items: AiMeetingPrepRow[]
}): AiMeetingPrepQueueSnapshot {
  return {
    qa_marker: AI_MEETING_PREP_QA_MARKER,
    queue_label: "AI Meeting Prep Ready",
    items: input.items,
    summary: {
      total: input.items.length,
      draft: input.items.filter((item) => item.status === "draft").length,
      approved: input.items.filter((item) => item.status === "approved").length,
      rejected: input.items.filter((item) => item.status === "rejected").length,
      stale: input.items.filter((item) => item.status === "stale").length,
    },
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  }
}

export function mapAiMeetingPrepRowToArtifacts(row: AiMeetingPrepRow): AiMeetingPrepGeneratedArtifacts {
  return {
    executive_brief: row.executive_brief,
    meeting_objective: row.meeting_objective,
    suggested_agenda: row.suggested_agenda,
    stakeholder_analysis: row.stakeholder_analysis,
    likely_objections: row.likely_objections,
    discovery_questions: row.discovery_questions,
    competitive_risks: row.competitive_risks,
    recommended_outcome: row.recommended_outcome,
    confidence_score: row.confidence_score,
    reasoning: row.reasoning,
  }
}
