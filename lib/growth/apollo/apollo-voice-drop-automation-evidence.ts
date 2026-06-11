/** Apollo Voice Drop Automation evidence helpers — client-safe. */

import type {
  ApolloVoiceDropAttributionRecord,
  ApolloVoiceDropCandidateQueueSnapshot,
  ApolloVoiceDropCandidateRow,
  ApolloVoiceDropCandidateStatus,
  ApolloVoiceDropSourceAttribution,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
  APOLLO_VOICE_DROP_SOURCE_ATTRIBUTION,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { buildApolloPipelineAttributionDisplay } from "@/lib/growth/apollo/apollo-pipeline-attribution-display"
import type { ApolloQueuePaginationMeta } from "@/lib/growth/apollo/apollo-queue-pagination"
import type {
  ApolloChannelAvailability,
  ApolloChannelRecommendation,
  ApolloMultichannelStrategy,
  ApolloVoiceDropIntelligence,
  ApolloVoiceDropScript,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

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

export function buildApolloVoiceDropAttributionChain(): ApolloVoiceDropSourceAttribution[] {
  return [...APOLLO_VOICE_DROP_SOURCE_ATTRIBUTION]
}

export function buildApolloVoiceDropAttributionRecord(
  enrollmentAttribution?: Record<string, unknown> | null,
): ApolloVoiceDropAttributionRecord {
  return {
    apollo_source: asString(enrollmentAttribution?.apollo_source) || "Apollo Primary Contact Acquisition",
    qualification_source:
      asString(enrollmentAttribution?.qualification_source) || "apollo_enrollment_qualification_engine",
    enrollment_source:
      asString(enrollmentAttribution?.enrollment_source) || "apollo_enrollment_automation",
    account_playbook_source:
      asString(enrollmentAttribution?.account_playbook_source) || "apollo_account_playbooks_abp_1",
    voice_drop_source: "apollo_voice_drop_automation",
    attribution_chain: buildApolloVoiceDropAttributionChain(),
  }
}

export function assertApolloVoiceDropAttributionPreserved(
  record: ApolloVoiceDropAttributionRecord | null | undefined,
): boolean {
  if (!record) return false
  return APOLLO_VOICE_DROP_SOURCE_ATTRIBUTION.every((entry) =>
    record.attribution_chain.includes(entry),
  )
}

export function mapApolloVoiceDropCandidateDbRow(
  row: Record<string, unknown>,
): ApolloVoiceDropCandidateRow {
  const contactSnapshot =
    row.contact_snapshot && typeof row.contact_snapshot === "object"
      ? (row.contact_snapshot as Record<string, unknown>)
      : {}
  const channelEvaluation =
    row.channel_evaluation && typeof row.channel_evaluation === "object"
      ? (row.channel_evaluation as ApolloChannelAvailability)
      : {
          verified_email: false,
          phone: false,
          mobile_phone: false,
          sms_capable: false,
          voice_drop_capable: false,
          linkedin: false,
        }
  const channelRecommendations =
    row.channel_recommendations && typeof row.channel_recommendations === "object"
      ? (row.channel_recommendations as ApolloChannelRecommendation)
      : {
          recommended_first_channel: "email" as const,
          recommended_second_channel: null,
          recommended_sequence_strategy: "Pending evaluation.",
          recommendation_reasons: [],
          confidence_score: 0,
        }
  const multichannelStrategy =
    row.multichannel_strategy && typeof row.multichannel_strategy === "object"
      ? (row.multichannel_strategy as ApolloMultichannelStrategy)
      : {
          strategy_key: "pending",
          strategy_label: "Pending",
          steps: [],
          recommendation_source: "apollo_multichannel_recommendation_engine",
          confidence: 0,
          reasoning: "Pending evaluation.",
        }
  const voiceDropIntelligence =
    row.voice_drop_intelligence && typeof row.voice_drop_intelligence === "object"
      ? (row.voice_drop_intelligence as ApolloVoiceDropIntelligence)
      : {
          recommended_script_type: "cold_introduction" as const,
          voicemail_objective: "Pending intelligence.",
          personalization_opportunities: [],
          call_to_action_recommendation: "Pending.",
          intelligence_summary: "Pending.",
        }
  const voiceDropScript =
    row.voice_drop_script && typeof row.voice_drop_script === "object"
      ? (row.voice_drop_script as ApolloVoiceDropScript)
      : {
          script_type: "cold_introduction" as const,
          intro: "",
          value_proposition: "",
          personalization_line: "",
          call_to_action: "",
          full_script: "",
          personalization_data: {},
        }
  const sourceAttribution =
    row.source_attribution && typeof row.source_attribution === "object"
      ? (row.source_attribution as ApolloVoiceDropAttributionRecord)
      : buildApolloVoiceDropAttributionRecord()

  return {
    candidate_id: asString(row.id),
    enrollment_candidate_id: asString(row.enrollment_candidate_id),
    company_candidate_id: asString(row.company_candidate_id),
    company_contact_id: asString(row.company_contact_id) || null,
    contact_candidate_id: asString(row.contact_candidate_id) || null,
    growth_lead_id: asString(row.growth_lead_id) || null,
    status: (asString(row.status) as ApolloVoiceDropCandidateStatus) || "pending_voice_drop_approval",
    company_name: asString(contactSnapshot.company_name) || "Unknown",
    full_name: asString(contactSnapshot.full_name) || "Unknown",
    title: asString(contactSnapshot.title) || null,
    email: asString(contactSnapshot.email) || null,
    phone: asString(contactSnapshot.phone) || null,
    qualification_score: asNumber(row.qualification_score),
    voice_drop_score: asNumber(row.voice_drop_score),
    recommendation_confidence: asNumber(row.recommendation_confidence),
    channel_availability: channelEvaluation,
    channel_recommendations: channelRecommendations,
    multichannel_strategy: multichannelStrategy,
    voice_drop_intelligence: voiceDropIntelligence,
    voice_drop_script: voiceDropScript,
    source_attribution: sourceAttribution,
    created_at: asString(row.created_at),
    voice_drop_approved_at: asString(row.voice_drop_approved_at) || null,
    voice_drop_approved_email: asString(row.voice_drop_approved_email) || null,
    attribution_display: buildApolloPipelineAttributionDisplay({
      source_attribution: sourceAttribution as unknown as Record<string, unknown>,
      approved_at: asString(row.voice_drop_approved_at) || null,
      approved_email: asString(row.voice_drop_approved_email) || null,
      approved_by: asString(row.voice_drop_approved_by) || null,
      rejection_note: asString(row.voice_drop_rejection_note) || null,
    }),
  }
}

export function buildApolloVoiceDropCandidateQueueSnapshot(input: {
  items: ApolloVoiceDropCandidateRow[]
  pagination?: ApolloQueuePaginationMeta
}): ApolloVoiceDropCandidateQueueSnapshot {
  const items = input.items
  return {
    qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
    queue_label: "Voice Drops Ready",
    items,
    summary: {
      total: items.length,
      pending: items.filter((row) => row.status === "pending_voice_drop_approval").length,
      approved: items.filter((row) => row.status === "voice_drop_approved").length,
      rejected: items.filter((row) => row.status === "voice_drop_rejected").length,
      intelligence_rerun: items.filter((row) => row.status === "intelligence_rerun_requested").length,
      voice_ready: items.filter((row) => row.channel_availability.voice_drop_capable).length,
    },
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
    pagination: input.pagination,
  }
}

export function evaluateApolloVoiceDropApprovalGate(input: {
  candidate: ApolloVoiceDropCandidateRow
}): { allowed: boolean; code: string | null } {
  if (input.candidate.status !== "pending_voice_drop_approval") {
    return { allowed: false, code: "invalid_candidate_status" }
  }
  if (!input.candidate.voice_drop_script.full_script.trim()) {
    return { allowed: false, code: "script_not_generated" }
  }
  return { allowed: true, code: null }
}

export function evaluateApolloVoiceDropDuplicateBlock(input: {
  existing_status: ApolloVoiceDropCandidateStatus | null
}): { blocked: boolean; code: string | null } {
  if (input.existing_status === "pending_voice_drop_approval") {
    return { blocked: true, code: "duplicate_pending_voice_drop" }
  }
  if (input.existing_status === "voice_drop_approved") {
    return { blocked: true, code: "already_voice_drop_approved" }
  }
  return { blocked: false, code: null }
}
