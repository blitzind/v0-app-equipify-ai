/**
 * Execution-1 — Approval job certification (read-only, no send/scheduler).
 * Run: pnpm certify:execution-1-approval-job:production
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { buildApolloEnrollmentSourceAttributionChain } from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"
import { growthSequenceExecutionHref } from "../lib/growth/sequence-enrollment/enrollment-navigation"

export const EXECUTION_1_QA_MARKER = "execution-1-approval-job-cert-v1" as const

const HENRY_SCHEIN_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const HENRY_SCHEIN_ENROLLMENT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"
const HENRY_SCHEIN_COMPANY_CANDIDATE_ID = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

async function main(): Promise<void> {
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { fetchGrowthSequenceSafeExecutionDashboard } = await import(
    "../lib/growth/sequences/execution/sequence-execution-dashboard"
  )
  const { fetchPatternEnrollmentDetail } = await import(
    "../lib/growth/sequence-enrollment/enrollment-detail"
  )
  const {
    enrichSequenceExecutionJobViews,
    listSequenceExecutionJobsForEnrollment,
    listSequenceExecutionJobEvents,
  } = await import("../lib/growth/sequences/execution/sequence-job-repository")
  const { fetchGrowthAiCopilotGenerationById } = await import("../lib/growth/ai-copilot-repository")

  const { data: enrollment } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id, status, sequence_pattern_id, started_at")
    .eq("id", HENRY_SCHEIN_ENROLLMENT_ID)
    .maybeSingle()

  const { data: steps } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("id, step_order, channel, status, generation_id, outreach_queue_id")
    .eq("enrollment_id", HENRY_SCHEIN_ENROLLMENT_ID)
    .order("step_order", { ascending: true })

  const step1 = (steps ?? []).find((row) => row.step_order === 1) ?? null

  const jobs = await listSequenceExecutionJobsForEnrollment(admin, HENRY_SCHEIN_ENROLLMENT_ID)
  const jobViews = await enrichSequenceExecutionJobViews(admin, jobs)
  const step1Job =
    jobs.find((job) => job.sequenceStepId === step1?.id) ??
    jobs.find((job) => job.leadId === HENRY_SCHEIN_LEAD_ID) ??
    null

  const dashboard = await fetchGrowthSequenceSafeExecutionDashboard(admin)
  const dashboardVisible = dashboard.jobs.some((job) => job.id === step1Job?.id)

  const enrollmentDetail = await fetchPatternEnrollmentDetail(admin, HENRY_SCHEIN_ENROLLMENT_ID, {
    actingUserEmail: "execution-1-cert@equipify.internal",
  })

  const generation = step1?.generation_id
    ? await fetchGrowthAiCopilotGenerationById(admin, step1.generation_id as string)
    : null

  const jobEvents = step1Job ? await listSequenceExecutionJobEvents(admin, step1Job.id, 20) : []

  const { count: outreachSentCount } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", HENRY_SCHEIN_LEAD_ID)
    .eq("status", "sent")

  const { count: outreachQueuedForStep } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("sequence_enrollment_step_id", step1?.id ?? "")

  const { data: draftAudit } = await admin
    .schema("growth")
    .from("apollo_primary_contact_enrollment_drafts")
    .select("source_attribution, auto_enrollment_attempted, outreach_sent, sequence_enrollment_id")
    .eq("sequence_enrollment_id", HENRY_SCHEIN_ENROLLMENT_ID)
    .maybeSingle()

  const { data: queueRow } = await admin
    .schema("growth")
    .from("apollo_primary_contact_enrollment_queue")
    .select("status, metadata")
    .eq("company_candidate_id", HENRY_SCHEIN_COMPANY_CANDIDATE_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const blockers: string[] = []

  if (enrollment?.status !== "active") blockers.push(`enrollment_not_active:${enrollment?.status ?? "missing"}`)
  if (!step1) blockers.push("step_1_missing")
  if (step1 && !["draft_created", "queued"].includes(step1.status as string)) {
    blockers.push(`step_1_not_materialized:${step1.status}`)
  }
  if (!step1?.generation_id) blockers.push("step_1_missing_generation_id")
  if (!step1Job) blockers.push("execution_job_missing")
  if (step1Job && step1Job.status !== "pending_approval") {
    blockers.push(`job_status_not_pending_approval:${step1Job.status}`)
  }
  if (!dashboardVisible) blockers.push("job_not_in_execution_dashboard")
  if (!generation?.generatedContent?.trim()) blockers.push("generation_draft_content_missing")
  if (step1Job?.deliveryAttemptId) blockers.push("transport_delivery_attempt_present")
  if (step1Job?.humanApprovedAt) blockers.push("job_already_human_approved")
  if ((outreachSentCount ?? 0) > 0) blockers.push("outreach_sent")
  if (step1Job?.status === "sent") blockers.push("execution_job_sent")

  const expectedAttribution = buildApolloEnrollmentSourceAttributionChain()
  const draftAttribution = draftAudit?.source_attribution
  if (!Array.isArray(draftAttribution) || !expectedAttribution.every((v) => draftAttribution.includes(v))) {
    blockers.push("apollo_attribution_incomplete")
  }

  const certification = blockers.length === 0 ? "PASS" : blockers.length <= 2 ? "PASS_PARTIAL" : "FAIL"

  const executionHref = step1Job
    ? growthSequenceExecutionHref({
        enrollmentId: HENRY_SCHEIN_ENROLLMENT_ID,
        leadId: HENRY_SCHEIN_LEAD_ID,
        highlightJobId: step1Job.id,
      })
    : growthSequenceExecutionHref({ enrollmentId: HENRY_SCHEIN_ENROLLMENT_ID, leadId: HENRY_SCHEIN_LEAD_ID })

  const payload = {
    ok: certification === "PASS" || certification === "PASS_PARTIAL",
    qa_marker: EXECUTION_1_QA_MARKER,
    certification,
    blockers,
    enrollment_confirmation: {
      lead_id: HENRY_SCHEIN_LEAD_ID,
      enrollment_id: HENRY_SCHEIN_ENROLLMENT_ID,
      enrollment_status: enrollment?.status ?? null,
      started_at: enrollment?.started_at ?? null,
    },
    step_materialization: {
      step_id: step1?.id ?? null,
      step_order: step1?.step_order ?? null,
      channel: step1?.channel ?? null,
      status: step1?.status ?? null,
      generation_id: step1?.generation_id ?? null,
      materialized: Boolean(step1?.generation_id && ["draft_created", "queued"].includes(step1.status as string)),
    },
    execution_job: step1Job
      ? {
          job_id: step1Job.id,
          status: step1Job.status,
          channel: step1Job.channel,
          requires_human_approval: step1Job.requiresHumanApproval,
          human_approved_at: step1Job.humanApprovedAt,
          delivery_attempt_id: step1Job.deliveryAttemptId,
          scheduled_for: step1Job.scheduledFor,
          sequence_step_id: step1Job.sequenceStepId,
        }
      : null,
    execution_readiness: {
      visible_in_execution_dashboard: dashboardVisible,
      dashboard_pending_approval: dashboard.pendingApproval,
      dashboard_job_count: dashboard.jobs.length,
      enrollment_detail_pending_approval: enrollmentDetail?.pendingApprovalJobCount ?? 0,
      execution_dashboard_href: executionHref,
    },
    approval_ui: {
      generation_id: generation?.id ?? null,
      generation_status: generation?.status ?? null,
      generation_type: generation?.generationType ?? null,
      has_subject: Boolean(generation?.generatedSubject?.trim()),
      has_body: Boolean(generation?.generatedContent?.trim()),
      body_preview_chars: generation?.generatedContent?.trim().length ?? 0,
      copilot_api_path: generation?.id
        ? `/api/platform/growth/copilot/generations/${generation.id}`
        : null,
      enrollment_detail_api_path: `/api/platform/growth/sequences/enrollments/${HENRY_SCHEIN_ENROLLMENT_ID}`,
    },
    safety: {
      outreach_sent_count: outreachSentCount ?? 0,
      outreach_queue_for_step: outreachQueuedForStep ?? 0,
      execution_job_sent: step1Job?.status === "sent",
      scheduler_run_executed_by_cert: false,
      auto_enrollment: draftAudit?.auto_enrollment_attempted ?? null,
      apollo_outreach_sent_flag: draftAudit?.outreach_sent ?? null,
    },
    apollo_attribution: {
      queue_status: queueRow?.status ?? null,
      draft_source_attribution: draftAttribution ?? null,
      expected_chain: expectedAttribution,
    },
    job_audit_events: jobEvents.map((event) => ({
      event_type: event.eventType,
      title: event.title,
      description: event.description,
      generation_id:
        event.metadata && typeof event.metadata.generation_id === "string"
          ? event.metadata.generation_id
          : null,
    })),
  }

  console.log(JSON.stringify(payload, null, 2))
  if (certification === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
