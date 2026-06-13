/** Apollo Meeting Bridge evidence helpers — client-safe. */

import type { DetectedBookingIntent } from "@/lib/growth/booking-intelligence/booking-intent-detector"
import { detectBookingIntentFromInbox } from "@/lib/growth/booking-intelligence/booking-intent-detector"
import type { GrowthInboxClassification } from "@/lib/growth/inbox/inbox-types"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type {
  ApolloMeetingBridgeAttributionRecord,
  ApolloMeetingBridgePipelineInput,
  ApolloMeetingBridgeQualificationStatusTrigger,
  ApolloMeetingBridgeReplyIntentTrigger,
  ApolloMeetingBridgeSourceAttribution,
  ApolloMeetingBridgeTriggerEvidence,
  ApolloMeetingCandidateQueueSnapshot,
  ApolloMeetingCandidateRow,
  ApolloMeetingCandidateStatus,
  ApolloMeetingReadinessSnapshot,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import {
  APOLLO_MEETING_BRIDGE_QA_MARKER,
  APOLLO_MEETING_BRIDGE_QUALIFICATION_STATUS_TRIGGERS,
  APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS,
  APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"

export const APOLLO_MEETING_BRIDGE_TRIGGER_RULE_VERSION = "m1a-v1" as const

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

function isReplyIntent(value: unknown): value is GrowthReplyIntent {
  return typeof value === "string" && value.length > 0
}

function replyIntentToInboxClassification(intent: GrowthReplyIntent | null): GrowthInboxClassification {
  switch (intent) {
    case "meeting_request":
    case "demo_request":
      return "meeting_intent"
    case "positive_interest":
      return "positive_interest"
    case "pricing_question":
      return "budget"
    case "objection":
      return "objection"
    case "not_interested":
      return "not_interested"
    case "unsubscribe":
      return "unsubscribe"
    default:
      return "neutral"
  }
}

export function buildApolloMeetingBridgeAttributionChain(): ApolloMeetingBridgeSourceAttribution[] {
  return [...APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION]
}

export function buildApolloMeetingBridgeAttributionRecord(
  prior?: Record<string, unknown> | null,
): ApolloMeetingBridgeAttributionRecord {
  const defaultChain = buildApolloMeetingBridgeAttributionChain()
  let attribution_chain = defaultChain

  if (Array.isArray(prior?.attribution_chain)) {
    const normalized = (prior.attribution_chain as string[]).map((entry) =>
      entry === "Multi-Channel Sequence" ? "Multi-Channel" : entry,
    )
    attribution_chain = normalized.includes("Meeting Candidate")
      ? (normalized as ApolloMeetingBridgeAttributionRecord["attribution_chain"])
      : ([
          ...normalized.filter((entry) => entry !== "Meeting Candidate"),
          "Reply Intelligence",
          "Meeting Candidate",
        ] as ApolloMeetingBridgeAttributionRecord["attribution_chain"])
  }

  return {
    apollo_source: asString(prior?.apollo_source) || "Apollo Primary Contact Acquisition",
    qualification_source:
      asString(prior?.qualification_source) || "apollo_enrollment_qualification_engine",
    enrollment_source: asString(prior?.enrollment_source) || "apollo_enrollment_automation",
    account_playbook_source:
      asString(prior?.account_playbook_source) || "apollo_account_playbooks_abp_1",
    voice_drop_source: asString(prior?.voice_drop_source) || "apollo_voice_drop_automation",
    multichannel_source:
      asString(prior?.multichannel_source) || "apollo_multichannel_orchestration_engine",
    sequence_execution_source:
      asString(prior?.sequence_execution_source) || "apollo_sequence_execution_automation",
    reply_intelligence_source: "growth_reply_intelligence_v2",
    meeting_candidate_source: "apollo_meeting_bridge_m1a",
    attribution_chain,
  }
}

export function assertApolloMeetingBridgeAttributionPreserved(
  record: ApolloMeetingBridgeAttributionRecord | null | undefined,
): boolean {
  if (!record) return false
  return APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION.every((entry) =>
    record.attribution_chain.includes(entry),
  )
}

export function evaluateApolloMeetingBridgeTriggerRules(
  input: ApolloMeetingBridgePipelineInput,
): ApolloMeetingBridgeTriggerEvidence {
  const matchedReplyIntents: ApolloMeetingBridgeReplyIntentTrigger[] = []
  const matchedQualificationSignals: ApolloMeetingBridgeQualificationStatusTrigger[] = []
  const evidenceSnippets: string[] = []

  const classificationV2 =
    typeof input.reply_intelligence.classification_v2 === "string"
      ? input.reply_intelligence.classification_v2
      : null
  // Prefer structured intent column; legacy classification is a separate enum (interested/unclassified/…).
  const replyIntent = input.reply_intelligence.intent ?? classificationV2 ?? null

  if (
    replyIntent &&
    APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS.includes(
      replyIntent as ApolloMeetingBridgeReplyIntentTrigger,
    )
  ) {
    matchedReplyIntents.push(replyIntent as ApolloMeetingBridgeReplyIntentTrigger)
    evidenceSnippets.push(`Reply intent ${replyIntent} matched configured trigger rule.`)
  }

  if (input.qualification.lead_status === "call_ready") {
    matchedQualificationSignals.push("call_ready")
    evidenceSnippets.push("Lead status call_ready matched configured trigger rule.")
  }

  const readinessTier =
    input.qualification.opportunity_readiness_tier ??
    input.lead.opportunity_readiness_tier ??
    null
  if (readinessTier === "sales_ready" || input.qualification.lead_status === "sales_ready") {
    matchedQualificationSignals.push("sales_ready")
    evidenceSnippets.push("Lead sales_ready tier matched configured trigger rule.")
  }

  const triggered =
    matchedReplyIntents.length > 0 || matchedQualificationSignals.length > 0

  return {
    triggered,
    trigger_source: matchedReplyIntents.length
      ? "reply_intelligence"
      : matchedQualificationSignals.length
        ? "qualification_state"
        : "none",
    matched_reply_intents: matchedReplyIntents,
    matched_qualification_signals: matchedQualificationSignals,
    evidence_snippets: evidenceSnippets,
    rule_version: APOLLO_MEETING_BRIDGE_TRIGGER_RULE_VERSION,
  }
}

export function detectBookingIntentFromReplyIntelligence(input: {
  intent: GrowthReplyIntent | null
  subject?: string | null
  body?: string | null
}): DetectedBookingIntent[] {
  if (!input.intent) return []
  return detectBookingIntentFromInbox({
    subject: input.subject ?? undefined,
    body: input.body ?? undefined,
    classification: replyIntentToInboxClassification(input.intent),
    source: "apollo_meeting_bridge_reply_intelligence",
  })
}

export function buildApolloMeetingReadinessSnapshot(input: {
  pipeline: ApolloMeetingBridgePipelineInput
  trigger_evidence: ApolloMeetingBridgeTriggerEvidence
  reply_confidence?: number | null
}): ApolloMeetingReadinessSnapshot {
  const qualificationScore = Math.min(
    100,
    Math.max(0, input.pipeline.qualification.qualification_score),
  )
  const committeeCoverageScore = Math.min(
    100,
    Math.max(0, input.pipeline.account_playbook.committee_coverage_score),
  )
  const classificationV2 =
    typeof input.pipeline.reply_intelligence.classification_v2 === "string"
      ? input.pipeline.reply_intelligence.classification_v2
      : null
  const replyIntent = input.pipeline.reply_intelligence.intent ?? classificationV2 ?? null
  const replyConfidence = input.reply_confidence ?? input.pipeline.reply_intelligence.confidence ?? null

  let meetingReadinessScore = qualificationScore * 0.35 + committeeCoverageScore * 0.25
  if (replyIntent === "meeting_request" || replyIntent === "demo_request") {
    meetingReadinessScore += 25
  } else if (replyIntent === "positive_interest" || replyIntent === "pricing_question") {
    meetingReadinessScore += 15
  }
  if (input.trigger_evidence.matched_qualification_signals.includes("call_ready")) {
    meetingReadinessScore += 10
  }
  if (input.trigger_evidence.matched_qualification_signals.includes("sales_ready")) {
    meetingReadinessScore += 12
  }
  if (typeof replyConfidence === "number" && replyConfidence > 0) {
    meetingReadinessScore += Math.min(10, replyConfidence * 10)
  }

  const readinessFactors: string[] = []
  if (qualificationScore >= 60) readinessFactors.push("qualification_ready")
  if (committeeCoverageScore >= 50) readinessFactors.push("committee_coverage_sufficient")
  if (input.trigger_evidence.matched_reply_intents.length > 0) {
    readinessFactors.push("reply_intent_trigger")
  }
  if (input.trigger_evidence.matched_qualification_signals.length > 0) {
    readinessFactors.push("qualification_trigger")
  }

  return {
    meeting_readiness_score: Math.min(100, Math.round(meetingReadinessScore)),
    committee_coverage_score: committeeCoverageScore,
    qualification_score: qualificationScore,
    reply_intent: replyIntent,
    reply_confidence: replyConfidence,
    trigger_evidence: input.trigger_evidence,
    readiness_factors: readinessFactors,
  }
}

export function computeApolloMeetingCandidateConfidenceScore(input: {
  meeting_readiness_snapshot: ApolloMeetingReadinessSnapshot
  trigger_evidence: ApolloMeetingBridgeTriggerEvidence
}): number {
  const base = input.meeting_readiness_snapshot.meeting_readiness_score / 100
  const triggerBoost =
    input.trigger_evidence.matched_reply_intents.includes("meeting_request") ||
    input.trigger_evidence.matched_reply_intents.includes("demo_request")
      ? 0.12
      : 0.05
  return Math.min(1, Math.round((base + triggerBoost) * 100) / 100)
}

export function evaluateApolloMeetingCandidateDuplicateBlock(input: {
  existing_status: ApolloMeetingCandidateStatus
}): { blocked: boolean; code: string | null } {
  if (input.existing_status === "pending_review" || input.existing_status === "approved") {
    return { blocked: true, code: "duplicate_meeting_candidate_pending_or_approved" }
  }
  return { blocked: false, code: null }
}

export function evaluateApolloMeetingCandidateApprovalGate(input: {
  candidate: ApolloMeetingCandidateRow
}): { allowed: boolean; code: string | null } {
  if (input.candidate.status !== "pending_review") {
    return { allowed: false, code: "invalid_candidate_status" }
  }
  if (!input.candidate.lead_id) {
    return { allowed: false, code: "lead_id_missing" }
  }
  if (input.candidate.meeting_readiness_score <= 0) {
    return { allowed: false, code: "meeting_readiness_missing" }
  }
  return { allowed: true, code: null }
}

export function mapApolloMeetingCandidateDbRow(row: Record<string, unknown>): ApolloMeetingCandidateRow {
  const sourceAttribution =
    row.source_attribution && typeof row.source_attribution === "object"
      ? (row.source_attribution as ApolloMeetingBridgeAttributionRecord)
      : buildApolloMeetingBridgeAttributionRecord(null)

  const committeeRoleSummary = Array.isArray(row.committee_role_summary)
    ? (row.committee_role_summary as ApolloMeetingCandidateRow["committee_role_summary"])
    : []

  const meetingReadinessSnapshot =
    row.meeting_readiness_snapshot && typeof row.meeting_readiness_snapshot === "object"
      ? (row.meeting_readiness_snapshot as ApolloMeetingReadinessSnapshot)
      : {
          meeting_readiness_score: asNumber(row.meeting_readiness_score),
          committee_coverage_score: asNumber(row.committee_coverage_score),
          qualification_score: 0,
          reply_intent: isReplyIntent(row.reply_intent) ? row.reply_intent : null,
          reply_confidence: asNumber(row.confidence_score) || null,
          trigger_evidence:
            row.trigger_evidence && typeof row.trigger_evidence === "object"
              ? (row.trigger_evidence as ApolloMeetingBridgeTriggerEvidence)
              : evaluateApolloMeetingBridgeTriggerRules({
                  lead: {
                    lead_id: asString(row.lead_id),
                    company_name: asString(row.company_name),
                    status: asString(row.lead_status),
                  },
                  company: {
                    company_id: asString(row.company_id) || null,
                    company_name: asString(row.company_name),
                  },
                  account_playbook: {
                    account_playbook_id: asString(row.account_playbook_id) || null,
                    committee_role_summary: committeeRoleSummary,
                    committee_coverage_score: asNumber(row.committee_coverage_score),
                    committee_strategy: asString(row.committee_strategy),
                  },
                  sequence_execution: {
                    sequence_execution_id: asString(row.sequence_execution_id) || null,
                  },
                  reply_intelligence: {
                    outbound_reply_id: asString(row.outbound_reply_id) || null,
                    intent: isReplyIntent(row.reply_intent) ? row.reply_intent : null,
                  },
                  qualification: {
                    qualification_score: 0,
                    lead_status: asString(row.lead_status),
                    qualification_snapshot:
                      row.qualification_snapshot && typeof row.qualification_snapshot === "object"
                        ? (row.qualification_snapshot as Record<string, unknown>)
                        : {},
                  },
                }),
          readiness_factors: [],
        }

  const triggerEvidence =
    row.trigger_evidence && typeof row.trigger_evidence === "object"
      ? (row.trigger_evidence as ApolloMeetingBridgeTriggerEvidence)
      : meetingReadinessSnapshot.trigger_evidence

  const bookingRecommendationCandidate =
    row.booking_recommendation_candidate && typeof row.booking_recommendation_candidate === "object"
      ? (row.booking_recommendation_candidate as ApolloMeetingCandidateRow["booking_recommendation_candidate"])
      : null

  return {
    candidate_id: asString(row.id),
    lead_id: asString(row.lead_id),
    company_id: asString(row.company_id) || null,
    company_candidate_id: asString(row.company_candidate_id) || null,
    account_playbook_id: asString(row.account_playbook_id) || null,
    sequence_execution_id: asString(row.sequence_execution_id) || null,
    outbound_reply_id: asString(row.outbound_reply_id) || null,
    growth_meeting_id: asString(row.growth_meeting_id) || null,
    booking_recommendation_id: asString(row.booking_recommendation_id) || null,
    company_name: asString(row.company_name),
    lead_status: asString(row.lead_status),
    qualification_snapshot:
      row.qualification_snapshot && typeof row.qualification_snapshot === "object"
        ? (row.qualification_snapshot as Record<string, unknown>)
        : {},
    committee_role_summary: committeeRoleSummary,
    committee_coverage_score: asNumber(row.committee_coverage_score),
    committee_strategy: asString(row.committee_strategy),
    meeting_readiness_score: asNumber(row.meeting_readiness_score),
    confidence_score: asNumber(row.confidence_score),
    meeting_readiness_snapshot: meetingReadinessSnapshot,
    booking_recommendation_candidate: bookingRecommendationCandidate,
    trigger_evidence: triggerEvidence,
    source_attribution: sourceAttribution,
    status: (asString(row.status) || "pending_review") as ApolloMeetingCandidateStatus,
    created_at: asString(row.created_at),
    approved_at: asString(row.approved_at) || null,
    approved_email: asString(row.approved_email) || null,
    rejection_note: asString(row.rejection_note) || null,
  }
}

export function buildApolloMeetingCandidateQueueSnapshot(input: {
  items: ApolloMeetingCandidateRow[]
}): ApolloMeetingCandidateQueueSnapshot {
  const pendingReview = input.items.filter((item) => item.status === "pending_review").length
  const approved = input.items.filter((item) => item.status === "approved").length
  const rejected = input.items.filter((item) => item.status === "rejected").length
  const scheduled = input.items.filter((item) => item.status === "scheduled").length
  const completed = input.items.filter((item) => item.status === "completed").length

  return {
    qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
    queue_label: "Meeting Candidates Ready",
    items: input.items,
    summary: {
      total: input.items.length,
      pending_review: pendingReview,
      approved,
      rejected,
      scheduled,
      completed,
      meeting_ready: pendingReview + approved,
    },
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}
