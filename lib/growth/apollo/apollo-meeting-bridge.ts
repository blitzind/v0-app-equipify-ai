/** Apollo Meeting Bridge — sequence execution + reply intelligence → meeting candidate (no schedule). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { generateBookingRecommendations } from "@/lib/growth/booking-intelligence/booking-recommendation"
import {
  buildApolloMeetingBridgeAttributionRecord,
  buildApolloMeetingReadinessSnapshot,
  computeApolloMeetingCandidateConfidenceScore,
  detectBookingIntentFromReplyIntelligence,
  evaluateApolloMeetingBridgeTriggerRules,
  evaluateApolloMeetingCandidateDuplicateBlock,
  mapApolloMeetingCandidateDbRow,
} from "@/lib/growth/apollo/apollo-meeting-bridge-evidence"
import type {
  ApolloMeetingBridgePipelineInput,
  ApolloMeetingBridgeResult,
  ApolloMeetingCandidateStatus,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import { APOLLO_MEETING_BRIDGE_QA_MARKER } from "@/lib/growth/apollo/apollo-meeting-bridge-types"

const TABLE = "meeting_candidates"

function skipResult(
  action: ApolloMeetingBridgeResult["action"],
  input: {
    trigger_evidence?: ApolloMeetingBridgeResult["trigger_evidence"]
    meeting_readiness_snapshot?: ApolloMeetingBridgeResult["meeting_readiness_snapshot"]
    error?: string | null
  },
): ApolloMeetingBridgeResult {
  return {
    ok: true,
    action,
    meeting_candidate_created: false,
    candidate_id: null,
    status: null,
    meeting_readiness_snapshot: input.meeting_readiness_snapshot ?? null,
    booking_recommendation_candidate: null,
    trigger_evidence: input.trigger_evidence ?? null,
    error: input.error ?? null,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}

async function findDuplicateMeetingCandidate(
  admin: SupabaseClient,
  input: ApolloMeetingBridgePipelineInput,
): Promise<{ id: string; status: ApolloMeetingCandidateStatus } | null> {
  if (input.reply_intelligence.outbound_reply_id) {
    const { data } = await admin
      .schema("growth")
      .from(TABLE)
      .select("id, status")
      .eq("outbound_reply_id", input.reply_intelligence.outbound_reply_id)
      .in("status", ["pending_review", "approved"])
      .limit(1)
      .maybeSingle()
    if (data && typeof data.id === "string") {
      return { id: data.id, status: data.status as ApolloMeetingCandidateStatus }
    }
  }

  if (input.sequence_execution.sequence_execution_id) {
    const { data } = await admin
      .schema("growth")
      .from(TABLE)
      .select("id, status")
      .eq("lead_id", input.lead.lead_id)
      .eq("sequence_execution_id", input.sequence_execution.sequence_execution_id)
      .in("status", ["pending_review", "approved"])
      .limit(1)
      .maybeSingle()
    if (data && typeof data.id === "string") {
      return { id: data.id, status: data.status as ApolloMeetingCandidateStatus }
    }
  }

  return null
}

export async function bridgeApolloPipelineToMeetingIntelligence(
  admin: SupabaseClient,
  input: ApolloMeetingBridgePipelineInput,
): Promise<ApolloMeetingBridgeResult> {
  const triggerEvidence = evaluateApolloMeetingBridgeTriggerRules(input)
  const meetingReadinessSnapshot = buildApolloMeetingReadinessSnapshot({
    pipeline: input,
    trigger_evidence: triggerEvidence,
    reply_confidence: input.reply_intelligence.confidence,
  })

  if (!triggerEvidence.triggered) {
    return skipResult("skip_no_trigger", {
      trigger_evidence: triggerEvidence,
      meeting_readiness_snapshot: meetingReadinessSnapshot,
    })
  }

  const existing = await findDuplicateMeetingCandidate(admin, input)
  if (existing) {
    const duplicate = evaluateApolloMeetingCandidateDuplicateBlock({
      existing_status: existing.status,
    })
    if (duplicate.blocked) {
      return {
        ok: true,
        action: "skip_duplicate",
        meeting_candidate_created: false,
        candidate_id: existing.id,
        status: existing.status,
        meeting_readiness_snapshot: meetingReadinessSnapshot,
        booking_recommendation_candidate: null,
        trigger_evidence: triggerEvidence,
        error: duplicate.code,
        outreach_sent: false,
        calendar_written: false,
        meeting_scheduled: false,
      }
    }
  }

  const replyIntent =
    input.reply_intelligence.classification_v2 ?? input.reply_intelligence.intent ?? null
  const bookingIntents = detectBookingIntentFromReplyIntelligence({
    intent: replyIntent,
    subject: input.reply_intelligence.subject,
    body: input.reply_intelligence.body,
  })
  const bookingRecommendations = generateBookingRecommendations({
    intents: bookingIntents,
    hasActiveSequence: input.reply_intelligence.has_active_sequence ?? false,
    engagementScore: input.reply_intelligence.engagement_score ?? undefined,
  })
  const bookingRecommendationCandidate = bookingRecommendations[0] ?? null

  const confidenceScore = computeApolloMeetingCandidateConfidenceScore({
    meeting_readiness_snapshot: meetingReadinessSnapshot,
    trigger_evidence: triggerEvidence,
  })
  const sourceAttribution = buildApolloMeetingBridgeAttributionRecord(input.source_attribution)

  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      lead_id: input.lead.lead_id,
      company_id: input.company.company_id,
      company_candidate_id: input.company.company_candidate_id ?? null,
      account_playbook_id: input.account_playbook.account_playbook_id,
      sequence_execution_id: input.sequence_execution.sequence_execution_id,
      outbound_reply_id: input.reply_intelligence.outbound_reply_id,
      status: "pending_review",
      company_name: input.company.company_name || input.lead.company_name,
      lead_status: input.qualification.lead_status || input.lead.status,
      reply_intent: replyIntent,
      qualification_snapshot: input.qualification.qualification_snapshot ?? {},
      committee_role_summary: input.account_playbook.committee_role_summary,
      committee_coverage_score: input.account_playbook.committee_coverage_score,
      committee_strategy: input.account_playbook.committee_strategy,
      meeting_readiness_score: meetingReadinessSnapshot.meeting_readiness_score,
      confidence_score: confidenceScore,
      meeting_readiness_snapshot: meetingReadinessSnapshot,
      booking_recommendation_candidate: bookingRecommendationCandidate,
      trigger_evidence: triggerEvidence,
      source_attribution: sourceAttribution,
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
      metadata: {
        qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
        sequence_enrollment_id: input.sequence_execution.sequence_enrollment_id ?? null,
        multichannel_sequence_candidate_id:
          input.sequence_execution.multichannel_sequence_candidate_id ?? null,
        voice_drop_candidate_id: input.sequence_execution.voice_drop_candidate_id ?? null,
        enrollment_candidate_id: input.sequence_execution.enrollment_candidate_id ?? null,
      },
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      ok: false,
      action: "create_meeting_candidate",
      meeting_candidate_created: false,
      candidate_id: null,
      status: null,
      meeting_readiness_snapshot: meetingReadinessSnapshot,
      booking_recommendation_candidate: bookingRecommendationCandidate,
      trigger_evidence: triggerEvidence,
      error: error?.message ?? "meeting_candidate_insert_failed",
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
    }
  }

  const candidate = mapApolloMeetingCandidateDbRow(data as Record<string, unknown>)

  await logGrowthEngine("apollo_meeting_bridge_candidate_created", {
    candidate_id: candidate.candidate_id,
    lead_id: candidate.lead_id,
    sequence_execution_id: candidate.sequence_execution_id,
    outbound_reply_id: candidate.outbound_reply_id,
    meeting_readiness_score: candidate.meeting_readiness_score,
    trigger_source: triggerEvidence.trigger_source,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  })

  return {
    ok: true,
    action: "create_meeting_candidate",
    meeting_candidate_created: true,
    candidate_id: candidate.candidate_id,
    status: candidate.status,
    meeting_readiness_snapshot: meetingReadinessSnapshot,
    booking_recommendation_candidate: bookingRecommendationCandidate,
    trigger_evidence: triggerEvidence,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}

export async function loadApolloMeetingBridgePipelineInputForLead(
  admin: SupabaseClient,
  input: {
    lead_id: string
    outbound_reply_id?: string | null
    sequence_execution_candidate_id?: string | null
  },
): Promise<ApolloMeetingBridgePipelineInput | null> {
  const { data: leadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, status, assigned_to, opportunity_readiness_tier, canonical_company_id")
    .eq("id", input.lead_id)
    .maybeSingle()

  if (!leadRow) return null

  let sequenceExecutionId = input.sequence_execution_candidate_id?.trim() || null
  let sequenceRow: Record<string, unknown> | null = null

  if (sequenceExecutionId) {
    const { data } = await admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .eq("id", sequenceExecutionId)
      .maybeSingle()
    sequenceRow = (data as Record<string, unknown> | null) ?? null
  } else {
    const { data } = await admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .eq("growth_lead_id", input.lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    sequenceRow = (data as Record<string, unknown> | null) ?? null
    sequenceExecutionId =
      sequenceRow && typeof sequenceRow.id === "string" ? sequenceRow.id : null
  }

  let playbookRow: Record<string, unknown> | null = null
  if (sequenceRow && typeof sequenceRow.enrollment_candidate_id === "string") {
    const { data } = await admin
      .schema("growth")
      .from("account_playbooks")
      .select("*")
      .eq("enrollment_candidate_id", sequenceRow.enrollment_candidate_id)
      .eq("status", "playbook_approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    playbookRow = (data as Record<string, unknown> | null) ?? null
  }

  if (!playbookRow) {
    const { data } = await admin
      .schema("growth")
      .from("account_playbooks")
      .select("*")
      .eq("growth_lead_id", input.lead_id)
      .eq("status", "playbook_approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    playbookRow = (data as Record<string, unknown> | null) ?? null
  }

  let replyRow: Record<string, unknown> | null = null
  if (input.outbound_reply_id) {
    const { data } = await admin
      .schema("growth")
      .from("outbound_replies")
      .select("*")
      .eq("id", input.outbound_reply_id)
      .maybeSingle()
    replyRow = (data as Record<string, unknown> | null) ?? null
  }

  const sourceAttribution =
    (sequenceRow?.source_attribution as Record<string, unknown> | undefined) ??
    (playbookRow?.source_attribution as Record<string, unknown> | undefined) ??
    {}

  const committeeRoleSummary = Array.isArray(playbookRow?.committee_role_summary)
    ? (playbookRow.committee_role_summary as ApolloMeetingBridgePipelineInput["account_playbook"]["committee_role_summary"])
    : []

  return {
    lead: {
      lead_id: String(leadRow.id),
      company_name: String(leadRow.company_name ?? ""),
      status: String(leadRow.status ?? ""),
      owner_user_id: typeof leadRow.assigned_to === "string" ? leadRow.assigned_to : null,
      opportunity_readiness_tier:
        typeof leadRow.opportunity_readiness_tier === "string"
          ? leadRow.opportunity_readiness_tier
          : null,
    },
    company: {
      company_id:
        typeof leadRow.canonical_company_id === "string" ? leadRow.canonical_company_id : null,
      company_name: String(leadRow.company_name ?? ""),
      canonical_company_id:
        typeof leadRow.canonical_company_id === "string" ? leadRow.canonical_company_id : null,
      company_candidate_id:
        typeof sequenceRow?.company_candidate_id === "string"
          ? sequenceRow.company_candidate_id
          : typeof playbookRow?.company_candidate_id === "string"
            ? playbookRow.company_candidate_id
            : null,
    },
    account_playbook: {
      account_playbook_id: typeof playbookRow?.id === "string" ? playbookRow.id : null,
      committee_role_summary: committeeRoleSummary,
      committee_coverage_score:
        typeof playbookRow?.committee_coverage_score === "number"
          ? playbookRow.committee_coverage_score
          : 0,
      committee_strategy:
        typeof playbookRow?.committee_strategy === "string" ? playbookRow.committee_strategy : "",
      coverage_status:
        typeof playbookRow?.coverage_status === "string" ? playbookRow.coverage_status : null,
    },
    sequence_execution: {
      sequence_execution_id: sequenceExecutionId,
      sequence_enrollment_id:
        typeof sequenceRow?.sequence_enrollment_id === "string"
          ? sequenceRow.sequence_enrollment_id
          : null,
      multichannel_sequence_candidate_id:
        typeof sequenceRow?.multichannel_sequence_candidate_id === "string"
          ? sequenceRow.multichannel_sequence_candidate_id
          : null,
      voice_drop_candidate_id:
        typeof sequenceRow?.voice_drop_candidate_id === "string"
          ? sequenceRow.voice_drop_candidate_id
          : null,
      enrollment_candidate_id:
        typeof sequenceRow?.enrollment_candidate_id === "string"
          ? sequenceRow.enrollment_candidate_id
          : null,
      status: typeof sequenceRow?.status === "string" ? sequenceRow.status : null,
    },
    reply_intelligence: {
      outbound_reply_id: input.outbound_reply_id ?? (typeof replyRow?.id === "string" ? replyRow.id : null),
      intent: typeof replyRow?.intent === "string" ? (replyRow.intent as ApolloMeetingBridgePipelineInput["reply_intelligence"]["intent"]) : null,
      classification_v2:
        typeof replyRow?.classification_v2 === "string"
          ? (replyRow.classification_v2 as ApolloMeetingBridgePipelineInput["reply_intelligence"]["classification_v2"])
          : null,
      confidence: typeof replyRow?.confidence === "number" ? replyRow.confidence : null,
      confidence_tier:
        typeof replyRow?.confidence_tier === "string" ? replyRow.confidence_tier : null,
      subject: typeof replyRow?.subject === "string" ? replyRow.subject : null,
      body:
        typeof replyRow?.body_preview === "string"
          ? replyRow.body_preview
          : typeof replyRow?.body === "string"
            ? replyRow.body
            : null,
      engagement_score:
        typeof replyRow?.engagement_score === "number" ? replyRow.engagement_score : null,
      has_active_sequence: Boolean(
        sequenceRow?.sequence_enrollment_id ?? input.outbound_reply_id,
      ),
    },
    qualification: {
      qualification_score:
        typeof sequenceRow?.qualification_score === "number"
          ? sequenceRow.qualification_score
          : typeof playbookRow?.confidence_score === "number"
            ? playbookRow.confidence_score
            : 0,
      lead_status: String(leadRow.status ?? ""),
      opportunity_readiness_tier:
        typeof leadRow.opportunity_readiness_tier === "string"
          ? leadRow.opportunity_readiness_tier
          : null,
      qualification_snapshot:
        playbookRow?.qualification_snapshot &&
        typeof playbookRow.qualification_snapshot === "object"
          ? (playbookRow.qualification_snapshot as Record<string, unknown>)
          : {},
    },
    source_attribution: sourceAttribution,
  }
}

export async function maybeBridgeApolloPipelineToMeetingIntelligenceForLead(
  admin: SupabaseClient,
  input: {
    lead_id: string
    outbound_reply_id?: string | null
    sequence_execution_candidate_id?: string | null
  },
): Promise<ApolloMeetingBridgeResult | null> {
  const pipelineInput = await loadApolloMeetingBridgePipelineInputForLead(admin, input)
  if (!pipelineInput) return null
  if (!pipelineInput.sequence_execution.sequence_execution_id && !pipelineInput.account_playbook.account_playbook_id) {
    return null
  }
  return bridgeApolloPipelineToMeetingIntelligence(admin, pipelineInput)
}
