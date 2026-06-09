import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import {
  buildApolloEnrollmentSourceAttributionChain,
  readApolloEnrollmentDraftFromQueueMetadata,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"
import { APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"
import {
  APOLLO_PRIMARY_5_QA_MARKER,
  type ApolloPrimary5ApolloAttributionEvidence,
  type ApolloPrimary5CertificationReport,
  type ApolloPrimary5CertificationResult,
  type ApolloPrimary5DraftVerificationEvidence,
  type ApolloPrimary5EnrollmentConfirmationEvidence,
  type ApolloPrimary5ExecutionReadinessEvidence,
  type ApolloPrimary5SafetyEvidence,
  type ApolloPrimary5SequenceGenerationEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-confirmation-certification-types"
import { confirmGrowthSequenceEnrollment, materializeGrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listDueSequenceSchedulerSteps } from "@/lib/growth/sequence-enrollment/sequence-scheduler-repository"
import { fetchGrowthSequenceSafeExecutionDashboard } from "@/lib/growth/sequences/execution/sequence-execution-dashboard"
import { listSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"

export {
  APOLLO_PRIMARY_5_QA_MARKER,
  type ApolloPrimary5CertificationReport,
  type ApolloPrimary5CertificationResult,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-confirmation-certification-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function includesAttributionChain(values: unknown): boolean {
  const expected = APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION
  if (!Array.isArray(values)) return false
  return expected.every((entry) => values.includes(entry))
}

export async function certifyApolloPrimaryContactEnrollmentConfirmation(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    growth_lead_id: string
    enrollment_draft_id: string
    confirm_enabled?: boolean
    materialize_enabled?: boolean
    acting_user_id?: string | null
    acting_user_email?: string | null
  },
): Promise<ApolloPrimary5CertificationReport> {
  const blockers: string[] = []
  const confirmEnabled = input.confirm_enabled === true
  const materializeEnabled = input.materialize_enabled === true

  const { data: draftAudit } = await admin
    .schema("growth")
    .from("apollo_primary_contact_enrollment_drafts")
    .select("*")
    .eq("sequence_enrollment_id", input.enrollment_draft_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: draftEnrollmentRow } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("*")
    .eq("id", input.enrollment_draft_id)
    .maybeSingle()

  const lead = await fetchGrowthLeadById(admin, input.growth_lead_id)
  if (!lead) blockers.push("lead_not_found")

  const enrollmentBefore = draftEnrollmentRow
    ? await fetchGrowthSequenceEnrollmentById(admin, input.enrollment_draft_id)
    : null

  if (!enrollmentBefore) {
    blockers.push("enrollment_draft_not_found")
  }

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = enrollmentBefore
    ? patterns.find((entry) => entry.id === enrollmentBefore.sequencePatternId) ?? null
    : null

  const preflight = lead && enrollmentBefore
    ? await runSequenceEnrollmentPreflight(admin, lead, {
        patternId: enrollmentBefore.sequencePatternId,
        excludeEnrollmentId: enrollmentBefore.id,
      })
    : { allowed: false, code: "not_found" as const }

  const emailPreflight = lead
    ? await runGrowthOutreachPreflight(admin, {
        lead,
        channel: "email",
        toEmail: lead.contactEmail,
        generationType: "follow_up_email",
        generationApproved: false,
      })
    : { allowed: true }

  const { data: conflictingEnrollment } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, status")
    .eq("lead_id", input.growth_lead_id)
    .in("status", ["draft", "active", "paused"])
    .neq("id", input.enrollment_draft_id)
    .limit(1)
    .maybeSingle()

  const draftVerification: ApolloPrimary5DraftVerificationEvidence = {
    draft_exists: Boolean(draftAudit && enrollmentBefore),
    draft_status: enrollmentBefore?.status ?? "missing",
    enrollment_status_before_confirm: enrollmentBefore?.status ?? "missing",
    pattern_attached: Boolean(enrollmentBefore?.sequencePatternId && pattern),
    sequence_recommendation_attached: Boolean(
      enrollmentBefore?.sequencePatternId ||
        lead?.recommendedSequencePatternId ||
        lead?.recommendedSequenceConfidence,
    ),
    lead_ownership_valid: Boolean(lead?.ownerUserId || enrollmentBefore?.ownerUserId || enrollmentBefore?.createdBy),
    preflight_passed: preflight.allowed,
    preflight_code: preflight.code ?? null,
    suppression_blocked: emailPreflight.code === "suppressed",
    active_enrollment_conflict: Boolean(conflictingEnrollment),
    fatigue_blocked: lead?.sequenceFatigueRisk === "high",
    blockers: [],
  }

  if (!draftVerification.draft_exists) draftVerification.blockers.push("draft_not_found")
  if (enrollmentBefore && enrollmentBefore.status !== "draft" && enrollmentBefore.status !== "active") {
    draftVerification.blockers.push(`unexpected_enrollment_status:${enrollmentBefore.status}`)
  }
  if (!draftVerification.pattern_attached) draftVerification.blockers.push("pattern_not_attached")
  if (!draftVerification.preflight_passed) {
    draftVerification.blockers.push(preflight.code ?? "preflight_blocked")
  }
  if (draftVerification.suppression_blocked) draftVerification.blockers.push("suppressed")
  if (draftVerification.active_enrollment_conflict) draftVerification.blockers.push("active_enrollment_conflict")
  if (draftVerification.fatigue_blocked) draftVerification.blockers.push("fatigue_blocked")

  let confirmationExecuted = false
  let confirmationSkippedReason: string | null = null
  let confirmedEnrollment = enrollmentBefore

  if (!enrollmentBefore) {
    confirmationSkippedReason = "enrollment_missing"
  } else if (enrollmentBefore.status === "active") {
    confirmationSkippedReason = "already_active"
  } else if (enrollmentBefore.status !== "draft") {
    confirmationSkippedReason = `invalid_status:${enrollmentBefore.status}`
    blockers.push(confirmationSkippedReason)
  } else if (!confirmEnabled) {
    confirmationSkippedReason = "confirm_disabled"
    blockers.push("confirm_not_executed")
  } else {
    const actingUserId =
      input.acting_user_id ||
      asString(draftAudit?.created_by) ||
      asString(enrollmentBefore.createdBy) ||
      "system"
    const actingUserEmail =
      input.acting_user_email ||
      asString(draftAudit?.created_by_email) ||
      "apollo-primary-5-cert@equipify.internal"

    try {
      confirmedEnrollment = await confirmGrowthSequenceEnrollment(admin, {
        leadId: input.growth_lead_id,
        enrollmentId: input.enrollment_draft_id,
        actingUserId,
        actingUserEmail,
      })
      confirmationExecuted = true
    } catch (error) {
      const code = error instanceof Error ? error.message : "confirm_failed"
      confirmationSkippedReason = code
      blockers.push(`confirm_failed:${code}`)
    }
  }

  let materializeExecuted = false
  let materializeSkippedReason: string | null = null

  const enrollment = confirmedEnrollment
    ? await fetchGrowthSequenceEnrollmentById(admin, input.enrollment_draft_id)
    : null
  let steps = enrollment ? await listGrowthSequenceEnrollmentSteps(admin, enrollment.id) : []

  if (enrollment?.status === "active") {
    const pendingStep1 = steps.find((step) => step.stepOrder === 1 && step.status === "pending")
    if (!pendingStep1) {
      materializeSkippedReason = "step_1_not_pending"
    } else if (!materializeEnabled) {
      materializeSkippedReason = "materialize_disabled"
    } else {
      const actingUserId =
        input.acting_user_id ||
        asString(draftAudit?.created_by) ||
        asString(enrollment.createdBy) ||
        "system"
      const actingUserEmail =
        input.acting_user_email ||
        asString(draftAudit?.created_by_email) ||
        "apollo-primary-5-cert@equipify.internal"

      try {
        await materializeGrowthSequenceEnrollmentStep(admin, {
          enrollmentId: enrollment.id,
          stepOrder: 1,
          actingUserId,
          actingUserEmail,
        })
        materializeExecuted = true
        steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
      } catch (error) {
        const code = error instanceof Error ? error.message : "materialize_failed"
        materializeSkippedReason = code
        blockers.push(`materialize_failed:${code}`)
      }
    }
  }

  const patternAfter = enrollment
    ? patterns.find((entry) => entry.id === enrollment.sequencePatternId) ?? null
    : null

  const stepOrders = steps.map((step) => step.stepOrder)
  const expectedOrders = patternAfter?.steps.map((step) => step.stepOrder).sort((a, b) => a - b) ?? []
  const invalidOrdering =
    stepOrders.length > 0 &&
    (stepOrders.some((order, index) => order !== index + 1) ||
      JSON.stringify([...stepOrders].sort((a, b) => a - b)) !== JSON.stringify(expectedOrders))

  const sequenceGeneration: ApolloPrimary5SequenceGenerationEvidence = {
    step_count: steps.length,
    step_orders: stepOrders,
    channels: steps.map((step) => step.channel),
    step_statuses: steps.map((step) => step.status),
    orphaned_steps: expectedOrders.length > 0 ? Math.max(0, expectedOrders.length - steps.length) : 0,
    missing_channels: patternAfter
      ? patternAfter.steps
          .filter((patternStep) => !steps.some((step) => step.stepOrder === patternStep.stepOrder))
          .map((patternStep) => patternStep.channel)
      : [],
    invalid_ordering: invalidOrdering,
  }

  if (enrollment?.status !== "active") {
    blockers.push(`enrollment_not_active:${enrollment?.status ?? "missing"}`)
  }
  if (sequenceGeneration.orphaned_steps > 0) blockers.push("orphaned_steps")
  if (sequenceGeneration.missing_channels.length > 0) blockers.push("missing_channels")
  if (sequenceGeneration.invalid_ordering) blockers.push("invalid_step_ordering")

  const executionJobs = enrollment
    ? (await listSequenceExecutionJobs(admin, { limit: 200 })).filter(
        (job) => job.sequenceEnrollmentId === enrollment.id,
      )
    : []
  const dueSteps = await listDueSequenceSchedulerSteps(admin, 500)
  const schedulerVisible = enrollment
    ? dueSteps.some((step) => step.enrollmentId === enrollment.id)
    : false

  let executionDashboardVisible = false
  try {
    const dashboard = await fetchGrowthSequenceSafeExecutionDashboard(admin)
    executionDashboardVisible = dashboard.jobs.some((job) => job.sequenceEnrollmentId === enrollment?.id)
  } catch {
    executionDashboardVisible = executionJobs.length > 0
  }

  const approvalRequirements: string[] = []
  for (const job of executionJobs) {
    if (["draft", "pending_approval"].includes(job.status)) {
      approvalRequirements.push(`${job.channel}:${job.status}`)
    }
  }
  for (const step of steps) {
    if (step.status === "draft_created") {
      approvalRequirements.push(`step_${step.stepOrder}:${step.channel}:draft_created`)
    }
  }

  const executionBlockers: string[] = []
  if (enrollment?.enrollmentStalled) executionBlockers.push("enrollment_stalled")
  if (enrollment?.pauseReason) executionBlockers.push(`paused:${enrollment.pauseReason}`)

  const executionReadiness: ApolloPrimary5ExecutionReadinessEvidence = {
    visible_in_execution_dashboard: executionDashboardVisible || executionJobs.length > 0 || schedulerVisible,
    visible_in_scheduler: schedulerVisible,
    execution_jobs_for_enrollment: executionJobs.length,
    pending_approval_jobs: executionJobs.filter((job) => ["draft", "pending_approval"].includes(job.status)).length,
    execution_blockers: executionBlockers,
    approval_requirements: approvalRequirements,
  }

  const { data: queueRow } = await admin
    .schema("growth")
    .from("apollo_primary_contact_enrollment_queue")
    .select("id, status, metadata")
    .eq("company_candidate_id", input.company_candidate_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const queueMetadata = (queueRow?.metadata ?? {}) as Record<string, unknown>
  const queueDraftFields = readApolloEnrollmentDraftFromQueueMetadata(queueMetadata)

  const { data: timelineRows } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("event_type, created_at")
    .eq("lead_id", input.growth_lead_id)
    .in("event_type", ["sequence_enrollment_created", "sequence_step_created", "sequence_step_queued"])
    .order("created_at", { ascending: false })
    .limit(20)

  const refreshedLead = await fetchGrowthLeadById(admin, input.growth_lead_id)

  const apolloAttribution: ApolloPrimary5ApolloAttributionEvidence = {
    source_chain: [...buildApolloEnrollmentSourceAttributionChain(), "Enrollment Confirmed"],
    queue_status: asString(queueRow?.status) || null,
    draft_audit_status: asString(draftAudit?.status) || null,
    draft_source_attribution: draftAudit?.source_attribution ?? null,
    queue_metadata_attribution:
      queueMetadata.apollo_enrollment_draft &&
      typeof queueMetadata.apollo_enrollment_draft === "object"
        ? (queueMetadata.apollo_enrollment_draft as Record<string, unknown>).source_attribution ?? null
        : null,
    timeline_events: (timelineRows ?? []).map((row) => asString(row.event_type)).filter(Boolean),
    lead_active_enrollment_id: refreshedLead?.activeSequenceEnrollmentId ?? null,
  }

  if (!includesAttributionChain(draftAudit?.source_attribution)) {
    blockers.push("draft_audit_attribution_incomplete")
  }
  if (!includesAttributionChain(apolloAttribution.queue_metadata_attribution)) {
    blockers.push("queue_metadata_attribution_incomplete")
  }
  if (queueDraftFields.enrollment_draft_id !== input.enrollment_draft_id) {
    blockers.push("queue_metadata_draft_id_mismatch")
  }
  if (queueDraftFields.growth_lead_id !== input.growth_lead_id) {
    blockers.push("queue_metadata_lead_id_mismatch")
  }
  if (refreshedLead?.activeSequenceEnrollmentId !== input.enrollment_draft_id) {
    blockers.push("lead_active_enrollment_mismatch")
  }
  if (!apolloAttribution.timeline_events.includes("sequence_enrollment_created")) {
    blockers.push("missing_sequence_enrollment_created_timeline")
  }

  const { count: outreachSentCount } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.growth_lead_id)
    .eq("status", "sent")

  const executionJobsSent = executionJobs.filter((job) => job.status === "sent").length

  const safety: ApolloPrimary5SafetyEvidence = {
    auto_enrollment: false,
    outreach_sent: false,
    apollo_draft_auto_enrollment:
      typeof draftAudit?.auto_enrollment_attempted === "boolean" ? draftAudit.auto_enrollment_attempted : null,
    apollo_draft_outreach_sent: typeof draftAudit?.outreach_sent === "boolean" ? draftAudit.outreach_sent : null,
    outreach_queue_sent_count: outreachSentCount ?? 0,
    execution_jobs_sent_count: executionJobsSent,
    scheduler_runs_triggered: false,
  }

  if (safety.apollo_draft_auto_enrollment === true) blockers.push("apollo_auto_enrollment_true")
  if (safety.apollo_draft_outreach_sent === true) blockers.push("apollo_outreach_sent_true")
  if (safety.outreach_queue_sent_count > 0) blockers.push("outreach_queue_sent")
  if (safety.execution_jobs_sent_count > 0) blockers.push("execution_jobs_sent")

  const enrollmentConfirmation: ApolloPrimary5EnrollmentConfirmationEvidence = {
    lead_id: input.growth_lead_id,
    draft_id: input.enrollment_draft_id,
    enrollment_id: enrollment?.id ?? input.enrollment_draft_id,
    sequence_pattern_id: enrollment?.sequencePatternId ?? null,
    pattern_id: enrollment?.sequencePatternId ?? null,
    pattern_key: patternAfter?.key ?? null,
    enrollment_status: enrollment?.status ?? "missing",
    step_count: steps.length,
    approval_state:
      approvalRequirements.length > 0
        ? approvalRequirements.join("; ")
        : steps.find((step) => step.status === "draft_created")
          ? "draft_created_awaiting_approval"
          : steps.find((step) => step.status === "pending")
            ? "pending_scheduled"
            : enrollment?.status === "active"
              ? "active"
              : "unknown",
    confirmation_executed: confirmationExecuted,
    confirmation_skipped_reason: confirmationSkippedReason,
    materialize_executed: materializeExecuted,
    materialize_skipped_reason: materializeSkippedReason,
  }

  let certification: ApolloPrimary5CertificationResult = "PASS"
  if (blockers.length > 0) {
    const onlyConfirmSkipped = blockers.every((entry) =>
      ["confirm_not_executed", "materialize_disabled"].includes(entry),
    )
    const materializeEnvOnly = blockers.every((entry) =>
      entry.startsWith("materialize_failed:ai_not_configured") ||
      entry.startsWith("materialize_failed:copilot_disabled"),
    )
    if (enrollment?.status === "active" && (onlyConfirmSkipped || materializeEnvOnly)) {
      certification = "PASS_PARTIAL"
    } else if (
      enrollment?.status === "active" &&
      blockers.every((entry) => entry === "confirm_not_executed")
    ) {
      certification = "PASS_PARTIAL"
    } else {
      certification = "FAIL"
    }
  } else if (
    enrollment?.status === "active" &&
    steps.some((step) => step.stepOrder === 1 && step.status === "pending")
  ) {
    certification = "PASS_PARTIAL"
  }

  return {
    qa_marker: APOLLO_PRIMARY_5_QA_MARKER,
    certification,
    blockers: [...new Set(blockers)],
    draft_verification: draftVerification,
    enrollment_confirmation: enrollmentConfirmation,
    sequence_generation: sequenceGeneration,
    execution_readiness: executionReadiness,
    apollo_attribution: apolloAttribution,
    safety,
  }
}
