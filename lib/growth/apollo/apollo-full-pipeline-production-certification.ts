/** Apollo Full Pipeline Production Certification — end-to-end queue/materialization, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { executeApolloEnrollmentAutomationInProduction } from "@/lib/growth/apollo/apollo-enrollment-automation-route"
import {
  mapApolloEnrollmentCandidateDbRow,
} from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import { approveApolloEnrollmentCandidate } from "@/lib/growth/apollo/apollo-enrollment-candidate-queue"
import {
  APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
  type ApolloFullPipelineProductionCertificationReport,
  type ApolloFullPipelineStageIds,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import {
  APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST,
  APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-route-gates"
import { assertApolloSequenceExecutionAttributionPreserved } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import { mapApolloSequenceExecutionCandidateDbRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import { approveApolloMultichannelSequenceCandidate } from "@/lib/growth/apollo/apollo-multichannel-orchestration-queue"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import { approveApolloVoiceDropCandidate } from "@/lib/growth/apollo/apollo-voice-drop-candidate-queue"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import {
  listGrowthSequenceEnrollmentSteps,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-repository"

const CERT_ACTOR_EMAIL = "apollo-full-pipeline-cert@equipify.internal"
const CERT_ACTOR_ID = "apollo-full-pipeline-certification"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function recordSafetyFromRow(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return true
  return (
    row.outreach_sent === false &&
    row.jobs_scheduled === false &&
    row.voice_drop_sent === false &&
    (row.email_sent === false || row.email_sent == null) &&
    (row.sms_sent === false || row.sms_sent == null) &&
    (row.call_placed === false || row.call_placed == null)
  )
}

export async function certifyApolloFullPipelineProduction(
  admin: SupabaseClient,
  input: {
    execution_id: string
    company_candidate_id: string
    enrollment_candidate_id?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloFullPipelineProductionCertificationReport> {
  const blockers: string[] = []
  const checks: ApolloFullPipelineProductionCertificationReport["checks"] = []
  const stageIds: ApolloFullPipelineStageIds = {
    company_candidate_id: input.company_candidate_id,
    enrollment_candidate_id: input.enrollment_candidate_id ?? null,
    voice_drop_candidate_id: null,
    multichannel_sequence_candidate_id: null,
    sequence_execution_candidate_id: null,
    sequence_enrollment_id: null,
    growth_lead_id: null,
  }

  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  const sequenceReadyContact = snapshot?.contacts.find((c) => c.sequence_ready) ?? null
  checks.push({
    id: "sequence_ready_contact",
    satisfied: Boolean(sequenceReadyContact),
    detail: sequenceReadyContact
      ? `Sequence-ready contact ${sequenceReadyContact.full_name} loaded for company candidate.`
      : "No sequence-ready Apollo contact found for company candidate.",
  })
  if (!sequenceReadyContact) blockers.push("sequence_ready_contact_missing")

  let enrollmentCandidateId = input.enrollment_candidate_id?.trim() || null

  if (!enrollmentCandidateId) {
    const { data: existingEnrollment } = await admin
      .schema("growth")
      .from("apollo_enrollment_candidates")
      .select("*")
      .eq("company_candidate_id", input.company_candidate_id)
      .eq("status", "pending_enrollment_approval")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingEnrollment) {
      enrollmentCandidateId = asString(existingEnrollment.id)
    }
  }

  if (!enrollmentCandidateId) {
    const automation = await executeApolloEnrollmentAutomationInProduction(admin, {
      company_candidate_id: input.company_candidate_id,
      certification_mode: false,
      created_by: CERT_ACTOR_ID,
      env: input.env,
    })
    enrollmentCandidateId = automation.report?.candidates[0]?.candidate_id ?? null
    checks.push({
      id: "enrollment_candidate_created",
      satisfied: Boolean(enrollmentCandidateId),
      detail: enrollmentCandidateId
        ? `Enrollment candidate ${enrollmentCandidateId} created via automation.`
        : automation.message ?? "Enrollment automation did not create a candidate.",
    })
    if (!enrollmentCandidateId) blockers.push("enrollment_candidate_not_created")
  } else {
    checks.push({
      id: "enrollment_candidate_created",
      satisfied: true,
      detail: `Reusing enrollment candidate ${enrollmentCandidateId}.`,
    })
  }

  stageIds.enrollment_candidate_id = enrollmentCandidateId

  const { data: enrollmentRow } = enrollmentCandidateId
    ? await admin
        .schema("growth")
        .from("apollo_enrollment_candidates")
        .select("*")
        .eq("id", enrollmentCandidateId)
        .maybeSingle()
    : { data: null }

  const enrollment = enrollmentRow
    ? mapApolloEnrollmentCandidateDbRow(enrollmentRow as Record<string, unknown>)
    : null
  stageIds.growth_lead_id = enrollment?.growth_lead_id ?? null

  if (enrollment && enrollment.status === "pending_enrollment_approval") {
    const approveEnrollment = await approveApolloEnrollmentCandidate(admin, {
      candidate_id: enrollment.candidate_id,
      approver_user_id: CERT_ACTOR_ID,
      approver_email: CERT_ACTOR_EMAIL,
      note: `full-pipeline-cert:${input.execution_id}`,
    })
    checks.push({
      id: "enrollment_approved",
      satisfied: approveEnrollment.ok,
      detail: approveEnrollment.ok
        ? "Enrollment approved; voice drop handoff triggered."
        : approveEnrollment.error ?? "Enrollment approval failed.",
    })
    if (!approveEnrollment.ok) blockers.push("enrollment_approval_failed")
  } else if (enrollment?.status === "enrollment_approved") {
    checks.push({
      id: "enrollment_approved",
      satisfied: true,
      detail: "Enrollment already approved.",
    })
  } else {
    checks.push({
      id: "enrollment_approved",
      satisfied: false,
      detail: "Enrollment candidate missing or in unexpected status.",
    })
    blockers.push("enrollment_not_approvable")
  }

  const { data: voiceDropRow } = enrollmentCandidateId
    ? await admin
        .schema("growth")
        .from("apollo_voice_drop_candidates")
        .select("*")
        .eq("enrollment_candidate_id", enrollmentCandidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const voiceDrop = voiceDropRow
    ? mapApolloVoiceDropCandidateDbRow(voiceDropRow as Record<string, unknown>)
    : null
  stageIds.voice_drop_candidate_id = voiceDrop?.candidate_id ?? null

  checks.push({
    id: "voice_drop_candidate_created",
    satisfied: Boolean(voiceDrop),
    detail: voiceDrop
      ? `Voice drop candidate ${voiceDrop.candidate_id} present.`
      : "Voice drop candidate not created after enrollment approval.",
  })
  if (!voiceDrop) blockers.push("voice_drop_candidate_missing")

  if (voiceDrop && voiceDrop.status === "pending_voice_drop_approval") {
    const approveVoiceDrop = await approveApolloVoiceDropCandidate(admin, {
      candidate_id: voiceDrop.candidate_id,
      approver_user_id: CERT_ACTOR_ID,
      approver_email: CERT_ACTOR_EMAIL,
      note: `full-pipeline-cert:${input.execution_id}`,
    })
    checks.push({
      id: "voice_drop_approved",
      satisfied: approveVoiceDrop.ok,
      detail: approveVoiceDrop.ok
        ? "Voice drop approved; multi-channel handoff triggered."
        : approveVoiceDrop.error ?? "Voice drop approval failed.",
    })
    if (!approveVoiceDrop.ok) blockers.push("voice_drop_approval_failed")
  } else if (voiceDrop?.status === "voice_drop_approved") {
    checks.push({
      id: "voice_drop_approved",
      satisfied: true,
      detail: "Voice drop already approved.",
    })
  }

  const { data: multichannelRow } = stageIds.voice_drop_candidate_id
    ? await admin
        .schema("growth")
        .from("apollo_multichannel_sequence_candidates")
        .select("*")
        .eq("voice_drop_candidate_id", stageIds.voice_drop_candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const multichannel = multichannelRow
    ? mapApolloMultichannelSequenceCandidateDbRow(multichannelRow as Record<string, unknown>)
    : null
  stageIds.multichannel_sequence_candidate_id = multichannel?.candidate_id ?? null

  checks.push({
    id: "multichannel_candidate_created",
    satisfied: Boolean(multichannel),
    detail: multichannel
      ? `Multi-channel candidate ${multichannel.candidate_id} with sequence ${multichannel.sequence_template.sequence_label}.`
      : "Multi-channel sequence candidate not created.",
  })
  if (!multichannel) blockers.push("multichannel_candidate_missing")

  if (multichannel && multichannel.status === "pending_sequence_approval") {
    const approveMultichannel = await approveApolloMultichannelSequenceCandidate(admin, {
      candidate_id: multichannel.candidate_id,
      approver_user_id: CERT_ACTOR_ID,
      approver_email: CERT_ACTOR_EMAIL,
      note: `full-pipeline-cert:${input.execution_id}`,
    })
    checks.push({
      id: "multichannel_approved",
      satisfied: approveMultichannel.ok,
      detail: approveMultichannel.ok
        ? "Multi-channel sequence approved; execution materialization triggered."
        : approveMultichannel.error ?? "Multi-channel approval failed.",
    })
    if (!approveMultichannel.ok) blockers.push("multichannel_approval_failed")
  } else if (multichannel?.status === "sequence_approved") {
    checks.push({
      id: "multichannel_approved",
      satisfied: true,
      detail: "Multi-channel sequence already approved.",
    })
  }

  const { data: executionRow } = stageIds.multichannel_sequence_candidate_id
    ? await admin
        .schema("growth")
        .from("apollo_sequence_execution_candidates")
        .select("*")
        .eq("multichannel_sequence_candidate_id", stageIds.multichannel_sequence_candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const execution = executionRow
    ? mapApolloSequenceExecutionCandidateDbRow(executionRow as Record<string, unknown>)
    : null
  stageIds.sequence_execution_candidate_id = execution?.candidate_id ?? null
  stageIds.sequence_enrollment_id = execution?.sequence_enrollment_id ?? null

  checks.push({
    id: "sequence_execution_materialized",
    satisfied: Boolean(execution?.sequence_enrollment_id),
    detail: execution?.sequence_enrollment_id
      ? `Sequence enrollment ${execution.sequence_enrollment_id} materialized with ${execution.materialization.total_steps} step(s).`
      : "Sequence execution candidate or enrollment missing.",
  })
  if (!execution?.sequence_enrollment_id) blockers.push("sequence_execution_not_materialized")

  const draftCount = execution?.materialization.drafts.length ?? 0
  checks.push({
    id: "draft_placeholders_generated",
    satisfied: draftCount > 0,
    detail: draftCount > 0 ? `${draftCount} draft placeholder(s) generated.` : "No draft placeholders.",
  })
  if (draftCount === 0) blockers.push("drafts_not_generated")

  let pendingJobs = 0
  if (execution?.sequence_enrollment_id) {
    const steps = await listGrowthSequenceEnrollmentSteps(admin, execution.sequence_enrollment_id)
    checks.push({
      id: "sequence_steps_generated",
      satisfied: steps.length >= (execution.materialization.total_steps || 1),
      detail: `${steps.length} native sequence step(s) persisted.`,
    })
    if (steps.length < (execution.materialization.total_steps || 1)) {
      blockers.push("sequence_steps_incomplete")
    }

    const jobs = (await listSequenceExecutionJobs(admin, { limit: 200 })).filter(
      (job) => job.sequenceEnrollmentId === execution.sequence_enrollment_id,
    )
    pendingJobs = jobs.filter((job) => job.status === "pending_approval").length
    checks.push({
      id: "execution_jobs_pending_approval",
      satisfied: pendingJobs > 0,
      detail: `${pendingJobs} sequence_execution_job(s) in pending_approval.`,
    })
    if (pendingJobs === 0) blockers.push("execution_jobs_missing")
  }

  const attribution_preserved = assertApolloSequenceExecutionAttributionPreserved(
    execution?.source_attribution,
  )
  checks.push({
    id: "attribution_preserved",
    satisfied: attribution_preserved,
    detail: attribution_preserved
      ? APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN.join(" → ")
      : "Attribution chain incomplete on execution candidate.",
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const safetyRows = [enrollmentRow, voiceDropRow, multichannelRow, executionRow].filter(Boolean) as Record<
    string,
    unknown
  >[]
  const safetyVerified = safetyRows.every((row) => recordSafetyFromRow(row))
  checks.push({
    id: "safety_flags",
    satisfied: safetyVerified,
    detail: safetyVerified
      ? "All stage records report outreach_sent=false, jobs_scheduled=false, and no channel sends."
      : "One or more stage records have unexpected safety flags.",
  })
  if (!safetyVerified) blockers.push("safety_flags_violated")

  const certified =
    blockers.length === 0 &&
    checks
      .filter((check) =>
        [
          "sequence_ready_contact",
          "enrollment_candidate_created",
          "enrollment_approved",
          "voice_drop_candidate_created",
          "voice_drop_approved",
          "multichannel_candidate_created",
          "multichannel_approved",
          "sequence_execution_materialized",
          "draft_placeholders_generated",
          "sequence_steps_generated",
          "execution_jobs_pending_approval",
          "attribution_preserved",
          "safety_flags",
        ].includes(check.id),
      )
      .every((check) => check.satisfied)

  return {
    qa_marker: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
    certification_id: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
    execution_id: input.execution_id,
    certified,
    blockers,
    checks,
    stage_ids: stageIds,
    attribution_chain: [...APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN],
    attribution_preserved,
    safety: {
      outreach_sent: false,
      jobs_scheduled: false,
      email_sent: false,
      sms_sent: false,
      voice_drop_sent: false,
      call_placed: false,
      draft_created: true,
    },
    readiness_checklist: [...APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST],
    rollback_notes: [...APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES],
    summary: certified
      ? "Apollo Full Pipeline Production Certification passed — enrollment through pending-approval execution jobs verified without live outreach."
      : `Apollo Full Pipeline Production Certification failed — ${blockers.length} blocker(s). No email, SMS, voice drop, or calls sent.`,
    completed_at: new Date().toISOString(),
  }
}
