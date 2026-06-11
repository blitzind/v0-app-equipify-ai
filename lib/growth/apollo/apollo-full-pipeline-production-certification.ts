/** Apollo Full Pipeline Production Certification — end-to-end queue/materialization, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapApolloEnrollmentCandidateDbRow,
} from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentAutomationReport } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import type {
  ApolloFullPipelineEnrollmentEvidence,
  ApolloFullPipelineMaterializationEvidence,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import {
  buildApolloFullPipelineMaterializationEvidence,
  evaluateApolloFullPipelineExecutionJobSafety,
  evaluateApolloFullPipelineStageSafety,
  summarizeApolloFullPipelineSafetyViolations,
} from "@/lib/growth/apollo/apollo-full-pipeline-materialization-evidence"
import {
  pickEnrollmentCandidateIdFromAutomationReport,
  selectSequenceReadyContactForCertification,
} from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import {
  buildApolloFullPipelineEnrollmentEvidence,
  executeApolloFullPipelineCertificationEnrollment,
  findReusableApolloEnrollmentCandidate,
  mapReusableEnrollmentCandidateId,
  scoreSequenceReadyContactsForCertification,
} from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution"
import {
  resolveApolloFullPipelineCertificationActor,
  APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE,
} from "@/lib/growth/apollo/apollo-full-pipeline-certification-actor"
import { buildApolloFullPipelineDbErrorEvidence } from "@/lib/growth/apollo/apollo-full-pipeline-db-error-evidence"
import {
  resolveApolloEnrollmentQualificationThreshold,
  resolveApolloFullPipelineCertificationQualificationThreshold,
} from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { approveApolloEnrollmentCandidate } from "@/lib/growth/apollo/apollo-enrollment-candidate-queue"
import { mapApolloAccountPlaybookDbRow } from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import { approveApolloAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-queue"
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
import { handoffMultichannelApprovedToSequenceExecution } from "@/lib/growth/apollo/apollo-sequence-execution-bridge"
import { buildApolloSequenceExecutionHandoffInput } from "@/lib/growth/apollo/apollo-sequence-execution-handoff-input"
import { applyApolloCertificationMultichannelTemplateOverride } from "@/lib/growth/apollo/apollo-certification-multichannel-template-override-bridge"
import { resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution } from "@/lib/growth/apollo/apollo-pipeline-growth-lead-resolution"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import { approveApolloVoiceDropCandidate } from "@/lib/growth/apollo/apollo-voice-drop-candidate-queue"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import {
  listGrowthSequenceEnrollmentSteps,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function certifyApolloFullPipelineProduction(
  admin: SupabaseClient,
  input: {
    execution_id: string
    company_candidate_id: string
    enrollment_candidate_id?: string | null
    actor_user_id?: string | null
    actor_email?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloFullPipelineProductionCertificationReport> {
  const actor = resolveApolloFullPipelineCertificationActor({
    actor_user_id: input.actor_user_id,
    actor_email: input.actor_email,
  })
  const blockers: string[] = []
  const checks: ApolloFullPipelineProductionCertificationReport["checks"] = []
  const stageIds: ApolloFullPipelineStageIds = {
    company_candidate_id: input.company_candidate_id,
    enrollment_candidate_id: input.enrollment_candidate_id ?? null,
    account_playbook_id: null,
    voice_drop_candidate_id: null,
    multichannel_sequence_candidate_id: null,
    sequence_execution_candidate_id: null,
    sequence_enrollment_id: null,
    growth_lead_id: null,
  }

  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  const productionThreshold = resolveApolloEnrollmentQualificationThreshold(input.env)
  const certificationThreshold = resolveApolloFullPipelineCertificationQualificationThreshold(input.env)
  const scoredContacts = await scoreSequenceReadyContactsForCertification(admin, {
    company_candidate_id: input.company_candidate_id,
    contacts: snapshot?.contacts ?? [],
    env: input.env,
  })
  const certificationSelection = selectSequenceReadyContactForCertification(scoredContacts, {
    production_threshold: productionThreshold,
    certification_threshold: certificationThreshold,
  })
  const sequenceReadyContact = certificationSelection?.contact ?? null

  checks.push({
    id: "sequence_ready_contact",
    satisfied: Boolean(sequenceReadyContact),
    detail: sequenceReadyContact
      ? `Sequence-ready contact ${sequenceReadyContact.full_name} selected for certification enrollment.`
      : "No sequence-ready contactable Apollo contact qualifies for certification enrollment.",
  })
  if (!sequenceReadyContact) {
    blockers.push("sequence_ready_contact_missing")
    if (scoredContacts.length > 0) {
      const best = [...scoredContacts].sort(
        (left, right) => right.qualification_score - left.qualification_score,
      )[0]
      blockers.push(
        `best_contact_below_certification_threshold:${best.contact.full_name}:${best.qualification_score}`,
      )
    }
  }

  if (sequenceReadyContact) {
    checks.push({
      id: "selected_contact_name",
      satisfied: true,
      detail: sequenceReadyContact.full_name,
    })
    checks.push({
      id: "qualification_score",
      satisfied: certificationSelection != null,
      detail:
        certificationSelection != null
          ? `Qualification score ${certificationSelection.qualification_score} (production threshold ${productionThreshold}, certification threshold ${certificationThreshold}).`
          : "Qualification score unavailable for selected contact.",
    })
    checks.push({
      id: "certification_override_used",
      satisfied: true,
      detail:
        certificationSelection?.threshold_source === "certification_override"
          ? `Certification override applied — threshold ${certificationThreshold} used instead of production ${productionThreshold}.`
          : `Production threshold ${productionThreshold} satisfied — no override required.`,
    })
  } else {
    checks.push({
      id: "selected_contact_name",
      satisfied: false,
      detail: "No contact selected.",
    })
    checks.push({
      id: "qualification_score",
      satisfied: false,
      detail: "Qualification score unavailable.",
    })
    checks.push({
      id: "certification_override_used",
      satisfied: false,
      detail: "Certification override not applied.",
    })
  }

  let enrollmentCandidateId = input.enrollment_candidate_id?.trim() || null
  let enrollmentReuseReason: string | null = null
  let enrollmentAutomationReport = null as ApolloEnrollmentAutomationReport | null
  let enrollmentAutomationMessage: string | null = null

  const reusableEnrollment = await findReusableApolloEnrollmentCandidate(admin, {
    enrollment_candidate_id: enrollmentCandidateId,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: sequenceReadyContact?.company_contact_id ?? null,
    contact_candidate_id: sequenceReadyContact?.contact_candidate_id ?? null,
  })

  if (reusableEnrollment) {
    enrollmentCandidateId = mapReusableEnrollmentCandidateId(reusableEnrollment.row)
    enrollmentReuseReason = reusableEnrollment.reuse_reason
  }

  if (!enrollmentCandidateId && sequenceReadyContact && certificationSelection) {
    try {
      enrollmentAutomationReport = await executeApolloFullPipelineCertificationEnrollment(admin, {
        execution_id: input.execution_id,
        company_candidate_id: input.company_candidate_id,
        selected_contact: sequenceReadyContact,
        threshold_used: certificationSelection.threshold_used,
        threshold_source: certificationSelection.threshold_source,
        production_threshold: productionThreshold,
        certification_threshold: certificationThreshold,
        actor_user_id: actor.actorUserId,
        actor_email: actor.actorEmail,
        certification_source: actor.certificationSource,
        audit_reason: actor.auditReason,
        env: input.env,
      })
      enrollmentCandidateId =
        pickEnrollmentCandidateIdFromAutomationReport(enrollmentAutomationReport, {
          company_contact_id: sequenceReadyContact.company_contact_id,
          contact_candidate_id: sequenceReadyContact.contact_candidate_id,
        }) ?? null

      if (!enrollmentCandidateId) {
        const postAutomationReuse = await findReusableApolloEnrollmentCandidate(admin, {
          company_candidate_id: input.company_candidate_id,
          company_contact_id: sequenceReadyContact.company_contact_id,
          contact_candidate_id: sequenceReadyContact.contact_candidate_id,
        })
        if (postAutomationReuse) {
          enrollmentCandidateId = mapReusableEnrollmentCandidateId(postAutomationReuse.row)
          enrollmentReuseReason = postAutomationReuse.reuse_reason
        } else if (enrollmentAutomationReport.blockers.length > 0) {
          enrollmentAutomationMessage = enrollmentAutomationReport.blockers.join(" | ")
        }
      }
    } catch (error) {
      enrollmentAutomationMessage = error instanceof Error ? error.message : String(error)
    }
  }

  const dbErrorEvidence = enrollmentAutomationMessage
    ? buildApolloFullPipelineDbErrorEvidence({
        message: enrollmentAutomationMessage,
        company_contact_id: sequenceReadyContact?.company_contact_id ?? null,
        contact_candidate_id: sequenceReadyContact?.contact_candidate_id ?? null,
        candidate_id: enrollmentCandidateId,
      })
    : null

  const enrollmentEvidence: ApolloFullPipelineEnrollmentEvidence =
    await buildApolloFullPipelineEnrollmentEvidence(admin, {
      company_candidate_id: input.company_candidate_id,
      sequence_ready_contact: sequenceReadyContact,
      automation_report: enrollmentAutomationReport,
      automation_message: enrollmentAutomationMessage,
      existing_enrollment_candidate_id: enrollmentCandidateId,
      existing_enrollment_candidate_status: reusableEnrollment
        ? asString(reusableEnrollment.row.status)
        : null,
      duplicate_prevention_decision: enrollmentReuseReason
        ? `reused_before_automation:${enrollmentReuseReason}`
        : undefined,
      qualification_score: certificationSelection?.qualification_score ?? null,
      qualification_threshold: certificationSelection?.threshold_used ?? productionThreshold,
      qualification_threshold_source: certificationSelection?.threshold_source ?? null,
      production_threshold: productionThreshold,
      certification_threshold: certificationThreshold,
      qualification_override_used:
        certificationSelection?.threshold_source === "certification_override",
      certification_source: APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE,
      db_error_table: dbErrorEvidence?.db_error_table ?? null,
      db_error_operation: dbErrorEvidence?.db_error_operation ?? null,
      db_error_message: dbErrorEvidence?.db_error_message ?? null,
      insert_error: dbErrorEvidence?.insert_error ?? undefined,
      env: input.env,
    })

  checks.push({
    id: "qualification_blockers",
    satisfied: enrollmentEvidence.qualification_blockers.length === 0 || Boolean(enrollmentCandidateId),
    detail:
      enrollmentEvidence.qualification_blockers.length > 0
        ? enrollmentEvidence.qualification_blockers.join(" | ")
        : "No qualification blockers for selected contact.",
  })

  if (enrollmentCandidateId) {
    checks.push({
      id: "enrollment_candidate_created",
      satisfied: true,
      detail: enrollmentReuseReason
        ? `Reusing enrollment candidate ${enrollmentCandidateId} (${enrollmentReuseReason}).`
        : certificationSelection?.threshold_source === "certification_override"
          ? `Enrollment candidate ${enrollmentCandidateId} created with certification threshold ${certificationThreshold} (score ${certificationSelection.qualification_score}).`
          : `Enrollment candidate ${enrollmentCandidateId} materialized at production threshold ${productionThreshold}.`,
    })
  } else {
    const evidenceSummary = [
      enrollmentEvidence.qualification_blockers.length > 0
        ? `Qualification blockers: ${enrollmentEvidence.qualification_blockers.join(" | ")}`
        : null,
      enrollmentEvidence.duplicate_prevention_decision
        ? `Duplicate prevention: ${enrollmentEvidence.duplicate_prevention_decision}`
        : null,
      enrollmentEvidence.insert_error ? `Insert error: ${enrollmentEvidence.insert_error}` : null,
      enrollmentEvidence.automation_message,
    ]
      .filter(Boolean)
      .join(" — ")

    checks.push({
      id: "enrollment_candidate_created",
      satisfied: false,
      detail:
        evidenceSummary ||
        enrollmentAutomationMessage ||
        "Enrollment automation did not create or reuse a candidate.",
    })
    blockers.push("enrollment_candidate_not_created")
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
  enrollmentEvidence.growth_lead_id = enrollment?.growth_lead_id ?? null

  if (enrollment && enrollment.status === "pending_enrollment_approval") {
    const approveEnrollment = await approveApolloEnrollmentCandidate(admin, {
      candidate_id: enrollment.candidate_id,
      approver_user_id: actor.actorUserId,
      approver_email: actor.actorEmail,
      note: `full-pipeline-cert:${input.execution_id}`,
    })
    checks.push({
      id: "enrollment_approved",
      satisfied: approveEnrollment.ok,
      detail: approveEnrollment.ok
        ? "Enrollment approved; account playbook handoff triggered."
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

  const { data: accountPlaybookRow } = enrollmentCandidateId
    ? await admin
        .schema("growth")
        .from("account_playbooks")
        .select("*")
        .eq("enrollment_candidate_id", enrollmentCandidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const accountPlaybook = accountPlaybookRow
    ? mapApolloAccountPlaybookDbRow(accountPlaybookRow as Record<string, unknown>)
    : null
  stageIds.account_playbook_id = accountPlaybook?.playbook_id ?? null

  checks.push({
    id: "account_playbook_created",
    satisfied: Boolean(accountPlaybook),
    detail: accountPlaybook
      ? `Account playbook ${accountPlaybook.playbook_id} present (${accountPlaybook.playbook_key}).`
      : "Account playbook not created after enrollment approval.",
  })
  if (!accountPlaybook) blockers.push("account_playbook_missing")

  if (accountPlaybook && accountPlaybook.status === "pending_playbook_approval") {
    const approvePlaybook = await approveApolloAccountPlaybook(admin, {
      playbook_id: accountPlaybook.playbook_id,
      approver_user_id: actor.actorUserId,
      approver_email: actor.actorEmail,
      note: `full-pipeline-cert:${input.execution_id}`,
    })
    checks.push({
      id: "account_playbook_approved",
      satisfied: approvePlaybook.ok,
      detail: approvePlaybook.ok
        ? "Account playbook approved; voice drop handoff triggered."
        : approvePlaybook.error ?? "Account playbook approval failed.",
    })
    if (!approvePlaybook.ok) blockers.push("account_playbook_approval_failed")
  } else if (accountPlaybook?.status === "playbook_approved") {
    checks.push({
      id: "account_playbook_approved",
      satisfied: true,
      detail: "Account playbook already approved.",
    })
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
      approver_user_id: actor.actorUserId,
      approver_email: actor.actorEmail,
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

  let multichannel = multichannelRow
    ? mapApolloMultichannelSequenceCandidateDbRow(multichannelRow as Record<string, unknown>)
    : null
  stageIds.multichannel_sequence_candidate_id = multichannel?.candidate_id ?? null

  let templateOverrideEvidence = null
  if (multichannel) {
    const templateOverride = await applyApolloCertificationMultichannelTemplateOverride(admin, {
      candidate_id: multichannel.candidate_id,
      email: multichannel.email,
      phone: multichannel.phone,
    })
    templateOverrideEvidence = templateOverride.evidence

    if (templateOverride.ok && templateOverride.evidence.certification_sequence_template_override_used) {
      const { data: refreshedMultichannelRow } = await admin
        .schema("growth")
        .from("apollo_multichannel_sequence_candidates")
        .select("*")
        .eq("id", multichannel.candidate_id)
        .maybeSingle()
      if (refreshedMultichannelRow) {
        multichannel = mapApolloMultichannelSequenceCandidateDbRow(
          refreshedMultichannelRow as Record<string, unknown>,
        )
      }
    }

    if (
      !templateOverride.ok ||
      templateOverride.evidence.materializable_steps_after === 0
    ) {
      blockers.push("multichannel_template_not_materializable")
    }
  }

  checks.push({
    id: "multichannel_candidate_created",
    satisfied: Boolean(multichannel),
    detail: multichannel
      ? `Multi-channel candidate ${multichannel.candidate_id} with sequence ${multichannel.sequence_template.sequence_label}.`
      : "Multi-channel sequence candidate not created.",
  })
  if (!multichannel) blockers.push("multichannel_candidate_missing")

  if (templateOverrideEvidence?.certification_sequence_template_override_used) {
    checks.push({
      id: "multichannel_template_materializable",
      satisfied: templateOverrideEvidence.materializable_steps_after > 0,
      detail: `Certification template override: ${templateOverrideEvidence.original_sequence_key} → ${templateOverrideEvidence.materialized_sequence_key} (${templateOverrideEvidence.materializable_steps_after} materializable step(s)).`,
    })
  } else if (multichannel) {
    checks.push({
      id: "multichannel_template_materializable",
      satisfied: (templateOverrideEvidence?.materializable_steps_after ?? 0) > 0,
      detail: templateOverrideEvidence?.template_override_blockers.length
        ? `Multichannel template not materializable: ${templateOverrideEvidence.template_override_blockers.join(" | ")}`
        : `Multichannel sequence ${multichannel.sequence_template.sequence_key} is materializable.`,
    })
  }

  if (multichannel && multichannel.status === "pending_sequence_approval") {
    const approveMultichannel = await approveApolloMultichannelSequenceCandidate(admin, {
      candidate_id: multichannel.candidate_id,
      approver_user_id: actor.actorUserId,
      approver_email: actor.actorEmail,
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

  let materializationEvidence: ApolloFullPipelineMaterializationEvidence | null = null
  let executionRow: Record<string, unknown> | null = null
  let handoffResult = null
  let growthLeadResolution = null

  if (multichannel && multichannel.status === "sequence_approved") {
    if (enrollmentCandidateId) {
      growthLeadResolution = await resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution(admin, {
        enrollment_candidate_id: enrollmentCandidateId,
        company_candidate_id: stageIds.company_candidate_id,
        company_contact_id:
          multichannel.company_contact_id ??
          enrollment?.company_contact_id ??
          accountPlaybook?.company_contact_id ??
          voiceDrop?.company_contact_id ??
          null,
        voice_drop_candidate_id: multichannel.voice_drop_candidate_id,
        multichannel_sequence_candidate_id: multichannel.candidate_id,
        created_by_user_id: actor.actorUserId,
        enrollment_row: (enrollmentRow as Record<string, unknown> | null) ?? null,
        account_playbook_row: (accountPlaybookRow as Record<string, unknown> | null) ?? null,
        voice_drop_row: (voiceDropRow as Record<string, unknown> | null) ?? null,
        multichannel_row: (multichannelRow as Record<string, unknown> | null) ?? null,
      })
      stageIds.growth_lead_id = growthLeadResolution.growth_lead_id
      if (enrollmentEvidence) {
        enrollmentEvidence.growth_lead_id = growthLeadResolution.growth_lead_id
      }
    }

    const { data: existingExecutionRow } = await admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .eq("multichannel_sequence_candidate_id", multichannel.candidate_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    executionRow = (existingExecutionRow as Record<string, unknown> | null) ?? null

    if (!executionRow?.sequence_enrollment_id) {
      const handoffInput = buildApolloSequenceExecutionHandoffInput({
        multichannel,
        growth_lead_id: growthLeadResolution?.growth_lead_id ?? stageIds.growth_lead_id ?? null,
        voice_drop_script_reference: voiceDrop?.voice_drop_script.full_script ?? null,
        created_by_user_id: actor.actorUserId,
      })
      handoffResult = await handoffMultichannelApprovedToSequenceExecution(admin, handoffInput)

      if (handoffResult.ok && handoffResult.candidate_id) {
        const { data: refreshedExecutionRow } = await admin
          .schema("growth")
          .from("apollo_sequence_execution_candidates")
          .select("*")
          .eq("id", handoffResult.candidate_id)
          .maybeSingle()
        executionRow = (refreshedExecutionRow as Record<string, unknown> | null) ?? executionRow
      } else if (!handoffResult.ok) {
        const { data: retryExecutionRow } = await admin
          .schema("growth")
          .from("apollo_sequence_execution_candidates")
          .select("*")
          .eq("multichannel_sequence_candidate_id", multichannel.candidate_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        executionRow = (retryExecutionRow as Record<string, unknown> | null) ?? executionRow
      }
    }

    const mappedExecution = executionRow
      ? mapApolloSequenceExecutionCandidateDbRow(executionRow)
      : null

    materializationEvidence = buildApolloFullPipelineMaterializationEvidence({
      attempted: true,
      reused: Boolean(
        handoffResult?.materialization_reused ||
          (mappedExecution && !handoffResult && Boolean(executionRow?.sequence_enrollment_id)),
      ),
      handoff: handoffResult,
      sequence_execution_candidate_id: mappedExecution?.candidate_id ?? handoffResult?.candidate_id ?? null,
      sequence_enrollment_id:
        mappedExecution?.sequence_enrollment_id ?? handoffResult?.sequence_enrollment_id ?? null,
      steps_created:
        mappedExecution?.materialization.total_steps ?? handoffResult?.steps_created ?? 0,
      draft_placeholders_created:
        mappedExecution?.materialization.drafts.length ??
        handoffResult?.draft_placeholders_created ??
        0,
      pending_approval_jobs_created: handoffResult?.pending_approval_jobs_created ?? 0,
      multichannel,
      growth_lead_resolution: growthLeadResolution,
      template_override: templateOverrideEvidence,
    })
  }

  const execution = executionRow
    ? mapApolloSequenceExecutionCandidateDbRow(executionRow as Record<string, unknown>)
    : null
  stageIds.sequence_execution_candidate_id = execution?.candidate_id ?? null
  stageIds.sequence_enrollment_id = execution?.sequence_enrollment_id ?? null

  const materializationDetail = execution?.sequence_enrollment_id
    ? `Sequence enrollment ${execution.sequence_enrollment_id} materialized with ${execution.materialization.total_steps} step(s).`
    : materializationEvidence?.materialization_error
      ? `Materialization failed: ${materializationEvidence.materialization_error}${
          materializationEvidence.materialization_error_table
            ? ` (table=${materializationEvidence.materialization_error_table}, operation=${materializationEvidence.materialization_error_operation})`
            : ""
        }`
      : "Sequence execution candidate or enrollment missing."

  checks.push({
    id: "sequence_execution_materialized",
    satisfied: Boolean(execution?.sequence_enrollment_id),
    detail: materializationDetail,
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

  const safetyViolations = [
    ...evaluateApolloFullPipelineStageSafety(
      enrollmentRow as Record<string, unknown> | null,
      "apollo_enrollment_candidates",
    ),
    ...evaluateApolloFullPipelineStageSafety(
      accountPlaybookRow as Record<string, unknown> | null,
      "apollo_account_playbooks",
    ),
    ...evaluateApolloFullPipelineStageSafety(
      voiceDropRow as Record<string, unknown> | null,
      "apollo_voice_drop_candidates",
    ),
    ...evaluateApolloFullPipelineStageSafety(
      multichannelRow as Record<string, unknown> | null,
      "apollo_multichannel_sequence_candidates",
    ),
    ...evaluateApolloFullPipelineStageSafety(
      executionRow as Record<string, unknown> | null,
      "apollo_sequence_execution_candidates",
    ),
  ]

  if (execution?.sequence_enrollment_id) {
    const executionJobs = (await listSequenceExecutionJobs(admin, { limit: 200 })).filter(
      (job) => job.sequenceEnrollmentId === execution.sequence_enrollment_id,
    )
    safetyViolations.push(
      ...evaluateApolloFullPipelineExecutionJobSafety({
        jobs: executionJobs.map((job) => ({ status: job.status })),
      }),
    )
  }

  const safetyVerified = safetyViolations.length === 0
  checks.push({
    id: "safety_flags",
    satisfied: safetyVerified,
    detail: summarizeApolloFullPipelineSafetyViolations(safetyViolations),
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
          "account_playbook_created",
          "account_playbook_approved",
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
    enrollment_evidence: enrollmentEvidence,
    materialization_evidence: materializationEvidence,
    stage_ids: stageIds,
    attribution_chain: [...APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN],
    attribution_preserved,
    safety_violations: safetyViolations,
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
