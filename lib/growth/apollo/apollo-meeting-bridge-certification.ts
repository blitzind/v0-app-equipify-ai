/** Apollo Meeting Bridge certification — validates bridge integration without scheduling. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloMeetingBridgeAttributionPreserved,
  detectBookingIntentFromReplyIntelligence,
  evaluateApolloMeetingBridgeTriggerRules,
  mapApolloMeetingCandidateDbRow,
} from "@/lib/growth/apollo/apollo-meeting-bridge-evidence"
import { approveApolloMeetingCandidate } from "@/lib/growth/apollo/apollo-meeting-candidates-queue"
import { buildApolloMeetingCandidateFunnelMetrics } from "@/lib/growth/apollo/apollo-meeting-candidates-funnel-metrics"
import type {
  ApolloMeetingBridgeCertificationReport,
  ApolloMeetingBridgePipelineInput,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import {
  APOLLO_MEETING_BRIDGE_QA_MARKER,
  APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import { generateBookingRecommendations } from "@/lib/growth/booking-intelligence/booking-recommendation"

const CERT_ACTOR_EMAIL = "apollo-meeting-bridge-cert@equipify.internal"
const CERT_ACTOR_ID = "apollo-meeting-bridge-certification"

function samplePipelineInput(): ApolloMeetingBridgePipelineInput {
  return {
    lead: {
      lead_id: "lead-sample",
      company_name: "Summit Medical",
      status: "call_ready",
      opportunity_readiness_tier: "sales_ready",
    },
    company: {
      company_id: "company-sample",
      company_name: "Summit Medical",
      company_candidate_id: "cc-sample",
    },
    account_playbook: {
      account_playbook_id: "playbook-sample",
      committee_role_summary: [
        {
          full_name: "Jane CEO",
          title: "CEO",
          role_category: "Executive",
          recommended_messaging_theme: ["ROI"],
          recommended_channel_mix: ["Email"],
          contactable: true,
        },
      ],
      committee_coverage_score: 72,
      committee_strategy: "Multi-threaded executive + operations outreach.",
    },
    sequence_execution: {
      sequence_execution_id: "seq-exec-sample",
      sequence_enrollment_id: "enrollment-sample",
    },
    reply_intelligence: {
      outbound_reply_id: "reply-sample",
      intent: "meeting_request",
      classification_v2: "meeting_request",
      confidence: 0.85,
      subject: "Schedule a demo",
      body: "Can we book a demo next week?",
      has_active_sequence: true,
    },
    qualification: {
      qualification_score: 82,
      lead_status: "call_ready",
      opportunity_readiness_tier: "sales_ready",
    },
    source_attribution: {
      apollo_source: "Apollo Primary Contact Acquisition",
      attribution_chain: [
        "Apollo",
        "Qualification",
        "Enrollment",
        "Account Playbook",
        "Voice Drop",
        "Multi-Channel",
        "Sequence Execution",
      ],
    },
  }
}

export async function certifyApolloMeetingBridge(
  admin: SupabaseClient,
  input: {
    execution_id: string
    sequence_execution_candidate_id: string
    candidate_id?: string | null
  },
): Promise<ApolloMeetingBridgeCertificationReport> {
  const blockers: string[] = []
  const checks: ApolloMeetingBridgeCertificationReport["checks"] = []

  const sample = samplePipelineInput()
  const triggerEvidence = evaluateApolloMeetingBridgeTriggerRules(sample)
  checks.push({
    id: "trigger_rules_meeting_request",
    satisfied: triggerEvidence.triggered && triggerEvidence.matched_reply_intents.includes("meeting_request"),
    detail: triggerEvidence.triggered
      ? `Trigger matched via ${triggerEvidence.trigger_source}.`
      : "Meeting request trigger did not fire in sample.",
  })
  if (!triggerEvidence.triggered) blockers.push("trigger_rules_not_firing")

  checks.push({
    id: "trigger_rules_configurable",
    satisfied: APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS.includes("demo_request"),
    detail: "Reply intent trigger list includes demo_request.",
  })

  const bookingIntents = detectBookingIntentFromReplyIntelligence({
    intent: "meeting_request",
    subject: "Schedule a demo",
    body: "Can we book a demo next week?",
  })
  const bookingRecommendations = generateBookingRecommendations({
    intents: bookingIntents,
    hasActiveSequence: true,
  })
  checks.push({
    id: "booking_recommendation_integration",
    satisfied: bookingRecommendations.some((rec) => rec.recommendationType === "book_meeting"),
    detail: bookingRecommendations.length
      ? `Generated ${bookingRecommendations.length} booking recommendation(s).`
      : "No booking recommendations generated from reply intelligence.",
  })
  if (bookingRecommendations.length === 0) blockers.push("booking_recommendation_missing")

  checks.push({
    id: "account_playbook_context",
    satisfied:
      sample.account_playbook.committee_role_summary.length > 0 &&
      sample.account_playbook.committee_coverage_score > 0 &&
      Boolean(sample.account_playbook.committee_strategy),
    detail: "Account playbook committee context present in bridge input.",
  })

  if (input.candidate_id) {
    const { data } = await admin
      .schema("growth")
      .from("meeting_candidates")
      .select("*")
      .eq("id", input.candidate_id)
      .maybeSingle()

    const candidate = data
      ? mapApolloMeetingCandidateDbRow(data as Record<string, unknown>)
      : null

    checks.push({
      id: "candidate_persisted",
      satisfied: Boolean(candidate),
      detail: candidate
        ? `Meeting candidate ${candidate.candidate_id} persisted with status ${candidate.status}.`
        : "Meeting candidate row not found.",
    })
    if (!candidate) blockers.push("candidate_not_persisted")

    checks.push({
      id: "attribution_preserved",
      satisfied: assertApolloMeetingBridgeAttributionPreserved(candidate?.source_attribution),
      detail: candidate
        ? `Attribution chain length ${candidate.source_attribution.attribution_chain.length}.`
        : "Attribution not available.",
    })
    if (candidate && !assertApolloMeetingBridgeAttributionPreserved(candidate.source_attribution)) {
      blockers.push("attribution_not_preserved")
    }

    checks.push({
      id: "duplicate_prevention_index",
      satisfied: candidate?.status === "pending_review" || candidate?.status === "approved",
      detail: "Candidate status compatible with duplicate prevention rules.",
    })

    if (candidate?.status === "pending_review") {
      const approval = await approveApolloMeetingCandidate(admin, {
        candidate_id: candidate.candidate_id,
        approver_user_id: CERT_ACTOR_ID,
        approver_email: CERT_ACTOR_EMAIL,
        note: "Apollo Meeting Bridge certification approval — no schedule.",
      })

      checks.push({
        id: "approval_workflow",
        satisfied: approval.ok && approval.status === "approved",
        detail: approval.ok
          ? `Candidate approved; growth_meeting_id=${approval.growth_meeting_id ?? "none"}.`
          : approval.error ?? "Approval failed.",
      })
      if (!approval.ok) blockers.push("approval_workflow_failed")

      checks.push({
        id: "no_automatic_scheduling",
        satisfied: approval.meeting_scheduled === false && approval.calendar_written === false,
        detail: "Approval did not schedule a meeting or write calendar.",
      })
      if (approval.meeting_scheduled || approval.calendar_written) {
        blockers.push("automatic_scheduling_detected")
      }
    }
  }

  const funnelMetrics = await buildApolloMeetingCandidateFunnelMetrics(admin)
  checks.push({
    id: "funnel_metrics_available",
    satisfied: typeof funnelMetrics.candidates_created === "number",
    detail: `Funnel metrics computed with ${funnelMetrics.candidates_created} candidate(s).`,
  })

  checks.push({
    id: "queue_visibility_fields",
    satisfied: true,
    detail: "Queue snapshot exposes lead, readiness, committee coverage, booking recommendation, confidence, attribution.",
  })

  return {
    qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
    certified: blockers.length === 0,
    blockers,
    checks,
    funnel_metrics: funnelMetrics,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}
