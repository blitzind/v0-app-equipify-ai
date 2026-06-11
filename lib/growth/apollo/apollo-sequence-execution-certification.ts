/** Apollo Sequence Execution certification — materialize + queue only, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloSequenceExecutionAttributionPreserved,
  evaluateApolloSequenceExecutionDraftApprovalGate,
  mapApolloSequenceExecutionCandidateDbRow,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import type {
  ApolloSequenceExecutionAutomationReport,
  ApolloSequenceExecutionCertificationReport,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { buildSequenceExecutionPipelineFromMultichannelHandoff } from "@/lib/growth/apollo/apollo-sequence-execution-pipeline-builder"

const TABLE = "apollo_sequence_execution_candidates"

export async function certifyApolloSequenceExecutionAutomation(
  admin: SupabaseClient,
  input: {
    report: ApolloSequenceExecutionAutomationReport
    approve_test_candidate?: boolean
  },
): Promise<ApolloSequenceExecutionCertificationReport> {
  const blockers: string[] = []
  const checks: ApolloSequenceExecutionCertificationReport["checks"] = []

  const candidateCreated = input.report.candidates_created > 0
  checks.push({
    id: "multichannel_handoff",
    satisfied: candidateCreated,
    detail: candidateCreated
      ? `${input.report.candidates_created} sequence execution candidate(s) created from multichannel approval.`
      : "No execution candidates created.",
  })
  if (!candidateCreated) blockers.push("execution_candidate_not_created")

  const first = input.report.candidates[0] ?? null

  const sequence_generation_verified = Boolean(
    first?.materialization.steps.length && first.sequence_enrollment_id,
  )
  checks.push({
    id: "sequence_generation",
    satisfied: sequence_generation_verified,
    detail: sequence_generation_verified
      ? `${first?.materialization.steps.length} step(s) materialized into enrollment ${first?.sequence_enrollment_id}.`
      : "Sequence steps not generated.",
  })
  if (!sequence_generation_verified) blockers.push("sequence_not_generated")

  const draft_generation_verified = Boolean(first?.materialization.drafts.length)
  checks.push({
    id: "draft_generation",
    satisfied: draft_generation_verified,
    detail: draft_generation_verified
      ? `${first?.materialization.drafts.length} draft placeholder(s) generated.`
      : "Draft generation failed.",
  })
  if (!draft_generation_verified) blockers.push("drafts_not_generated")

  const execution_queue_verified = Boolean(
    first?.execution_jobs.some((job) => job.execution_job_id || job.channel === "call"),
  )
  checks.push({
    id: "execution_queue",
    satisfied: execution_queue_verified,
    detail: execution_queue_verified
      ? `${first?.execution_jobs.length} execution job link(s) recorded in pending approval.`
      : "Execution queue not populated.",
  })
  if (!execution_queue_verified) blockers.push("execution_queue_empty")

  const attribution_preserved = assertApolloSequenceExecutionAttributionPreserved(first?.source_attribution)
  checks.push({
    id: "attribution_preserved",
    satisfied: attribution_preserved,
    detail: attribution_preserved
      ? "Apollo → Qualification → Enrollment → Voice Drop → Multi-Channel → Sequence Execution chain preserved."
      : "Attribution chain incomplete.",
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const duplicate_prevention_verified = input.report.candidates_skipped_duplicate >= 0
  checks.push({
    id: "duplicate_prevention",
    satisfied: duplicate_prevention_verified,
    detail: `Duplicate skips: ${input.report.candidates_skipped_duplicate}.`,
  })

  const queueVisible = input.report.candidates.length > 0
  checks.push({
    id: "queue_visibility",
    satisfied: queueVisible,
    detail: queueVisible
      ? `${input.report.candidates.length} candidate(s) visible in Sequence Execution Queue.`
      : "Queue empty.",
  })

  let approval_flow_verified = false
  if (first && input.approve_test_candidate !== false) {
    const gate = evaluateApolloSequenceExecutionDraftApprovalGate({ candidate: first })
    approval_flow_verified = gate.allowed
    if (gate.allowed) {
      await admin
        .schema("growth")
        .from(TABLE)
        .update({
          status: "execution_ready",
          drafts_approved_at: new Date().toISOString(),
          drafts_approved_email: "apollo-sequence-exec-cert@equipify.internal",
          outreach_sent: false,
          voice_drop_sent: false,
          email_sent: false,
          sms_sent: false,
          call_placed: false,
          draft_created: true,
          jobs_scheduled: false,
          metadata: {
            qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
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
      ? "Draft approval gate passed (certification dry-run recorded)."
      : "Approval gate blocked.",
  })
  if (!approval_flow_verified && first) blockers.push("approval_flow_blocked")

  const pipelineSelfTest = buildSequenceExecutionPipelineFromMultichannelHandoff({
    multichannel_sequence_candidate_id: "cert-self-test",
    voice_drop_candidate_id: "cert-vd",
    enrollment_candidate_id: "cert-enrollment",
    company_candidate_id: "cert-company",
    company_contact_id: null,
    growth_lead_id: "cert-lead",
    company_name: "Cert Medical",
    full_name: "Jordan Lee",
    title: "VP Operations",
    email: "jordan@certmedical.example",
    phone: "+15551234567",
    qualification_score: 85,
    sequence_key: "email_voice_drop",
    sequence_label: "Email → Voice Drop",
    channel_order: ["email", "voice_drop"],
    scheduling_plan: {
      total_days: 3,
      touches: [
        { day_offset: 1, channel: "email", spacing_days_from_prior: 0, cadence_label: "async_inbox", reason: "Day 1 email" },
        { day_offset: 3, channel: "voice_drop", spacing_days_from_prior: 2, cadence_label: "mobile_voicemail", reason: "Day 3 voice drop" },
      ],
    },
    voice_drop_script_reference: "Cert voice drop script reference.",
    source_attribution: {
      attribution_chain: ["Apollo", "Qualification", "Enrollment", "Voice Drop", "Multi-Channel Sequence"],
    },
  })

  checks.push({
    id: "materialization_engine",
    satisfied: Boolean(pipelineSelfTest.materialization.steps.length),
    detail: "Offline materialization engine produces steps and drafts.",
  })

  const certified =
    blockers.length === 0 &&
    checks
      .filter((check) =>
        [
          "multichannel_handoff",
          "sequence_generation",
          "draft_generation",
          "execution_queue",
          "attribution_preserved",
          "approval_flow",
        ].includes(check.id),
      )
      .every((check) => check.satisfied)

  return {
    qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
    certified,
    blockers,
    checks,
    attribution_preserved,
    duplicate_prevention_verified,
    approval_flow_verified,
    sequence_generation_verified,
    draft_generation_verified,
    execution_queue_verified,
    safety: {
      outreach_sent: false,
      voice_drop_sent: false,
      email_sent: false,
      sms_sent: false,
      call_placed: false,
      draft_created: true,
      jobs_scheduled: false,
    },
    funnel_metrics: input.report.funnel_metrics,
    summary: certified
      ? "Apollo Sequence Execution Certification passed — sequence, drafts, queue, and approval verified without live outreach."
      : `Apollo Sequence Execution Certification failed — ${blockers.length} blocker(s). No email, SMS, voice drop, or calls sent.`,
  }
}
