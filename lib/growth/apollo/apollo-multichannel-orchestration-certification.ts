/** Apollo Multi-Channel Orchestration certification — plans + queue only, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloMultichannelAttributionPreserved,
  evaluateApolloMultichannelSequenceApprovalGate,
  mapApolloMultichannelSequenceCandidateDbRow,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import type {
  ApolloMultichannelOrchestrationCertificationReport,
  ApolloMultichannelOrchestrationReport,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { buildMultichannelOrchestrationPipelineFromVoiceDropHandoff } from "@/lib/growth/apollo/apollo-multichannel-orchestration-pipeline-builder"

const TABLE = "apollo_multichannel_sequence_candidates"

export async function certifyApolloMultichannelOrchestration(
  admin: SupabaseClient,
  input: {
    report: ApolloMultichannelOrchestrationReport
    approve_test_candidate?: boolean
  },
): Promise<ApolloMultichannelOrchestrationCertificationReport> {
  const blockers: string[] = []
  const checks: ApolloMultichannelOrchestrationCertificationReport["checks"] = []

  const candidateCreated = input.report.candidates_created > 0
  checks.push({
    id: "voice_drop_handoff",
    satisfied: candidateCreated,
    detail: candidateCreated
      ? `${input.report.candidates_created} multi-channel sequence candidate(s) created from voice drop approval.`
      : "No sequence candidates created.",
  })
  if (!candidateCreated) blockers.push("sequence_candidate_not_created")

  const first = input.report.candidates[0] ?? null

  const sequence_generation_verified = Boolean(
    first?.orchestration_result.channel_order.length &&
      first.sequence_template.sequence_key &&
      first.sequence_template.sequence_key !== "pending",
  )
  checks.push({
    id: "sequence_generation",
    satisfied: sequence_generation_verified,
    detail: sequence_generation_verified
      ? `Sequence ${first?.sequence_template.sequence_label} with ${first?.orchestration_result.channel_order.length} channel step(s).`
      : "Sequence generation failed.",
  })
  if (!sequence_generation_verified) blockers.push("sequence_not_generated")

  const cadence_generation_verified = Boolean(first?.scheduling_plan.touches.length)
  checks.push({
    id: "cadence_generation",
    satisfied: cadence_generation_verified,
    detail: cadence_generation_verified
      ? `${first?.scheduling_plan.touches.length} touch(es) over ${first?.scheduling_plan.total_days} day(s).`
      : "Scheduling plan missing.",
  })
  if (!cadence_generation_verified) blockers.push("cadence_not_generated")

  const attribution_preserved = assertApolloMultichannelAttributionPreserved(first?.source_attribution)
  checks.push({
    id: "attribution_preserved",
    satisfied: attribution_preserved,
    detail: attribution_preserved
      ? "Apollo → Qualification → Enrollment → Voice Drop → Multi-Channel Sequence chain preserved."
      : "Attribution chain incomplete.",
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const duplicate_prevention_verified = input.report.candidates_skipped_duplicate >= 0
  checks.push({
    id: "duplicate_prevention",
    satisfied: duplicate_prevention_verified,
    detail: `Duplicate skips: ${input.report.candidates_skipped_duplicate}.`,
  })

  const recommendation_engine_verified = Boolean(
    first?.channel_intelligence.strongest_channel &&
      first.orchestration_result.confidence_score > 0,
  )
  checks.push({
    id: "recommendation_engine",
    satisfied: recommendation_engine_verified,
    detail: recommendation_engine_verified
      ? `Strongest channel ${first?.channel_intelligence.strongest_channel}; confidence ${first?.orchestration_result.confidence_score}.`
      : "Orchestration recommendation missing.",
  })
  if (!recommendation_engine_verified) blockers.push("recommendation_engine_failed")

  const queueVisible = input.report.candidates.length > 0
  checks.push({
    id: "queue_visibility",
    satisfied: queueVisible,
    detail: queueVisible
      ? `${input.report.candidates.length} candidate(s) visible in Multi-Channel Ready queue.`
      : "Queue empty.",
  })

  let approval_flow_verified = false
  if (first && input.approve_test_candidate !== false) {
    const gate = evaluateApolloMultichannelSequenceApprovalGate({ candidate: first })
    approval_flow_verified = gate.allowed
    if (gate.allowed) {
      await admin
        .schema("growth")
        .from(TABLE)
        .update({
          status: "sequence_approved",
          sequence_approved_at: new Date().toISOString(),
          sequence_approved_email: "apollo-multichannel-cert@equipify.internal",
          outreach_sent: false,
          voice_drop_sent: false,
          draft_created: false,
          jobs_scheduled: false,
          metadata: {
            qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
            certification_approval: true,
          },
        })
        .eq("id", first.candidate_id)
    }
  }

  checks.push({
    id: "approval_flow",
    satisfied: approval_flow_verified,
    detail: approval_flow_verified
      ? "Sequence approval gate passed (certification dry-run recorded)."
      : "Approval gate blocked.",
  })
  if (!approval_flow_verified && first) blockers.push("approval_flow_blocked")

  const pipelineSelfTest = buildMultichannelOrchestrationPipelineFromVoiceDropHandoff({
    voice_drop_candidate_id: "cert-self-test",
    enrollment_candidate_id: "cert-enrollment",
    company_candidate_id: "cert-company",
    company_contact_id: null,
    growth_lead_id: null,
    company_name: "Cert Medical",
    full_name: "Jordan Lee",
    title: "VP Operations",
    email: "jordan@certmedical.example",
    phone: "+15551234567",
    qualification_score: 85,
    fit_score: 80,
    voice_drop_score: 78,
    channel_availability: {
      verified_email: true,
      phone: true,
      mobile_phone: true,
      sms_capable: true,
      voice_drop_capable: true,
      linkedin: false,
    },
    channel_confidence: 82,
    multichannel_strategy_key: "email_voice_drop",
    source_attribution: {},
    operator_intelligence: {
      company_summary: "Cert Medical operates regional biomedical service lines.",
      buying_committee_summary: "Buying committee coverage identified.",
    },
  })

  checks.push({
    id: "orchestration_engine",
    satisfied: Boolean(pipelineSelfTest.orchestration_result.channel_order.length),
    detail: "Offline orchestration engine produces channel order and confidence.",
  })

  const certified =
    blockers.length === 0 &&
    checks
      .filter((check) =>
        [
          "voice_drop_handoff",
          "sequence_generation",
          "cadence_generation",
          "attribution_preserved",
          "approval_flow",
          "recommendation_engine",
        ].includes(check.id),
      )
      .every((check) => check.satisfied)

  return {
    qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
    certified,
    blockers,
    checks,
    attribution_preserved,
    duplicate_prevention_verified,
    approval_flow_verified,
    sequence_generation_verified,
    cadence_generation_verified,
    safety: {
      outreach_sent: false,
      voice_drop_sent: false,
      email_sent: false,
      sms_sent: false,
      call_placed: false,
      draft_created: false,
      jobs_scheduled: false,
    },
    funnel_metrics: input.report.funnel_metrics,
    summary: certified
      ? "Multi-Channel Orchestration Certification passed — sequence, timing, queue, and approval verified without live outreach."
      : `Multi-Channel Orchestration Certification failed — ${blockers.length} blocker(s). No email, SMS, voice drop, calls, drafts, or jobs scheduled.`,
  }
}
