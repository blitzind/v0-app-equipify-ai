/** Apollo Multi-Channel orchestration evidence — client-safe. */

import type {
  ApolloMultichannelAttributionRecord,
  ApolloMultichannelOperatorSummary,
  ApolloMultichannelOrchestrationResult,
  ApolloMultichannelSchedulingPlan,
  ApolloMultichannelSequenceCandidateRow,
  ApolloMultichannelSequenceCandidateStatus,
  ApolloMultichannelSequenceQueueSnapshot,
  ApolloMultichannelSequenceTemplate,
  ApolloMultichannelChannelIntelligence,
  ApolloMultichannelSourceAttribution,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import {
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
  APOLLO_MULTICHANNEL_SOURCE_ATTRIBUTION,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import type { ApolloChannelAvailability } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

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

export function buildApolloMultichannelAttributionChain(): ApolloMultichannelSourceAttribution[] {
  return [...APOLLO_MULTICHANNEL_SOURCE_ATTRIBUTION]
}

export function buildApolloMultichannelAttributionRecord(
  prior?: Record<string, unknown> | null,
): ApolloMultichannelAttributionRecord {
  return {
    apollo_source: asString(prior?.apollo_source) || "Apollo Primary Contact Acquisition",
    qualification_source:
      asString(prior?.qualification_source) || "apollo_enrollment_qualification_engine",
    enrollment_source: asString(prior?.enrollment_source) || "apollo_enrollment_automation",
    account_playbook_source:
      asString(prior?.account_playbook_source) || "apollo_account_playbooks_abp_1",
    voice_drop_source: asString(prior?.voice_drop_source) || "apollo_voice_drop_automation",
    multichannel_source: "apollo_multichannel_orchestration_engine",
    attribution_chain: buildApolloMultichannelAttributionChain(),
  }
}

export function assertApolloMultichannelAttributionPreserved(
  record: ApolloMultichannelAttributionRecord | null | undefined,
): boolean {
  if (!record) return false
  return APOLLO_MULTICHANNEL_SOURCE_ATTRIBUTION.every((entry) =>
    record.attribution_chain.includes(entry),
  )
}

export function mapApolloMultichannelSequenceCandidateDbRow(
  row: Record<string, unknown>,
): ApolloMultichannelSequenceCandidateRow {
  const contactSnapshot =
    row.contact_snapshot && typeof row.contact_snapshot === "object"
      ? (row.contact_snapshot as Record<string, unknown>)
      : {}
  const channelAvailability =
    row.channel_availability && typeof row.channel_availability === "object"
      ? (row.channel_availability as ApolloChannelAvailability)
      : {
          verified_email: false,
          phone: false,
          mobile_phone: false,
          sms_capable: false,
          voice_drop_capable: false,
          linkedin: false,
        }

  const readJson = <T>(value: unknown, fallback: T): T =>
    value && typeof value === "object" ? (value as T) : fallback

  return {
    candidate_id: asString(row.id),
    voice_drop_candidate_id: asString(row.voice_drop_candidate_id),
    enrollment_candidate_id: asString(row.enrollment_candidate_id),
    company_candidate_id: asString(row.company_candidate_id),
    company_contact_id: asString(row.company_contact_id) || null,
    growth_lead_id: asString(row.growth_lead_id) || null,
    status:
      (asString(row.status) as ApolloMultichannelSequenceCandidateStatus) ||
      "pending_sequence_approval",
    company_name: asString(contactSnapshot.company_name) || "Unknown",
    full_name: asString(contactSnapshot.full_name) || "Unknown",
    title: asString(contactSnapshot.title) || null,
    email: asString(contactSnapshot.email) || null,
    phone: asString(contactSnapshot.phone) || null,
    qualification_score: asNumber(row.qualification_score),
    fit_score: asNumber(row.fit_score) || null,
    orchestration_confidence: asNumber(row.orchestration_confidence),
    channel_availability: channelAvailability,
    orchestration_result: readJson(row.orchestration_result, {
      recommended_sequence: "Pending",
      channel_order: [],
      confidence_score: 0,
      reasoning: "Pending",
    } as ApolloMultichannelOrchestrationResult),
    sequence_template: readJson(row.sequence_template, {
      sequence_key: "pending",
      sequence_version: "v1",
      sequence_label: "Pending",
      channel_order: [],
      recommendation_reason: "Pending",
    } as ApolloMultichannelSequenceTemplate),
    scheduling_plan: readJson(row.scheduling_plan, {
      plan_version: "v1",
      total_days: 0,
      spacing_strategy: "pending",
      channel_cadence: "pending",
      touches: [],
    } as ApolloMultichannelSchedulingPlan),
    channel_intelligence: readJson(row.channel_intelligence, {
      strongest_channel: null,
      highest_confidence_channel: null,
      fallback_channels: [],
      channel_risk: "high",
      channel_scores: {},
      channel_recommendations: [],
      fallback_strategy: "Pending",
    } as ApolloMultichannelChannelIntelligence),
    operator_summary: readJson(row.operator_summary, {
      why_selected: "Pending",
      recommended_sequence: "Pending",
      confidence: 0,
      channel_availability_summary: "Pending",
      scheduling_summary: "Pending",
    } as ApolloMultichannelOperatorSummary),
    source_attribution: readJson(
      row.source_attribution,
      buildApolloMultichannelAttributionRecord(),
    ),
    created_at: asString(row.created_at),
    sequence_approved_at: asString(row.sequence_approved_at) || null,
    sequence_approved_email: asString(row.sequence_approved_email) || null,
  }
}

export function buildApolloMultichannelSequenceQueueSnapshot(input: {
  items: ApolloMultichannelSequenceCandidateRow[]
}): ApolloMultichannelSequenceQueueSnapshot {
  const items = input.items
  return {
    qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
    queue_label: "Multi-Channel Ready",
    items,
    summary: {
      total: items.length,
      pending: items.filter((r) => r.status === "pending_sequence_approval").length,
      approved: items.filter((r) => r.status === "sequence_approved").length,
      rejected: items.filter((r) => r.status === "sequence_rejected").length,
      regenerated: items.filter((r) => r.status === "recommendation_regenerated").length,
    },
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  }
}

export function evaluateApolloMultichannelSequenceApprovalGate(input: {
  candidate: ApolloMultichannelSequenceCandidateRow
}): { allowed: boolean; code: string | null } {
  if (input.candidate.status !== "pending_sequence_approval") {
    return { allowed: false, code: "invalid_candidate_status" }
  }
  if (!input.candidate.scheduling_plan.touches.length) {
    return { allowed: false, code: "scheduling_plan_missing" }
  }
  if (!input.candidate.orchestration_result.channel_order.length) {
    return { allowed: false, code: "sequence_not_generated" }
  }
  return { allowed: true, code: null }
}

export function evaluateApolloMultichannelDuplicateBlock(input: {
  existing_status: ApolloMultichannelSequenceCandidateStatus | null
}): { blocked: boolean; code: string | null } {
  if (input.existing_status === "pending_sequence_approval") {
    return { blocked: true, code: "duplicate_pending_sequence" }
  }
  if (input.existing_status === "sequence_approved") {
    return { blocked: true, code: "already_sequence_approved" }
  }
  return { blocked: false, code: null }
}
