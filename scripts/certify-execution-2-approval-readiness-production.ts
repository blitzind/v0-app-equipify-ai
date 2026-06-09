/**
 * Execution-2 — Human approval to send readiness (approve only, no send/scheduler).
 * Run: pnpm certify:execution-2-approval-readiness:production
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { buildApolloEnrollmentSourceAttributionChain } from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"

export const EXECUTION_2_QA_MARKER = "execution-2-approval-readiness-cert-v1" as const

const HENRY_SCHEIN_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const HENRY_SCHEIN_ENROLLMENT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"
const HENRY_SCHEIN_JOB_ID = "4d765ebd-c635-471c-8231-b0eb10b6a555"
const HENRY_SCHEIN_COMPANY_CANDIDATE_ID = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

async function resolveActingUser(admin: ReturnType<typeof createClient>) {
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", "%blitz%")
    .limit(1)
    .maybeSingle()
  return {
    userId: profile?.id ?? "631caf46-ff1d-4c12-a8aa-7c7c8953e9e4",
    email: profile?.email ?? "execution-2-cert@equipify.internal",
  }
}

async function main(): Promise<void> {
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const acting = await resolveActingUser(admin)

  const { getSequenceExecutionJob, listSequenceExecutionJobEvents } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )
  const { listApprovedDueSequenceExecutionJobs } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )
  const { fetchGrowthSequenceSafeExecutionDashboard } = await import(
    "../lib/growth/sequences/execution/sequence-execution-dashboard"
  )
  const { fetchGrowthAiCopilotGenerationById } = await import("../lib/growth/ai-copilot-repository")
  const { canUseGrowthOutboundSoloApproval } = await import("../lib/growth/runtime/outbound-solo-approval")
  const { approveSequenceExecutionJobSolo } = await import(
    "../lib/growth/sequences/execution/approve-sequence-execution-solo"
  )
  const { approveSequenceExecutionJob } = await import(
    "../lib/growth/sequences/execution/sequence-job-runner"
  )

  const jobBefore = await getSequenceExecutionJob(admin, HENRY_SCHEIN_JOB_ID)
  if (!jobBefore) {
    console.error(JSON.stringify({ ok: false, error: "execution_job_not_found" }))
    process.exit(1)
  }

  const { data: stepBefore } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("id, generation_id, status")
    .eq("id", jobBefore.sequenceStepId ?? "")
    .maybeSingle()

  const generationBefore = stepBefore?.generation_id
    ? await fetchGrowthAiCopilotGenerationById(admin, stepBefore.generation_id as string)
    : null

  const draftReview = {
    generation_id: generationBefore?.id ?? null,
    generation_status_before: generationBefore?.status ?? null,
    generation_type: generationBefore?.generationType ?? null,
    subject: generationBefore?.generatedSubject ?? null,
    body_chars: generationBefore?.generatedContent?.trim().length ?? 0,
    body_preview: generationBefore?.generatedContent?.trim().slice(0, 120) ?? null,
  }

  const soloEnabled = canUseGrowthOutboundSoloApproval({ platformAdmin: true })
  let approvalResult: Record<string, unknown>
  let approvalPath: string

  if (jobBefore.status === "approved" && jobBefore.humanApprovedAt) {
    approvalPath = "already_approved"
    approvalResult = {
      ok: true,
      status: jobBefore.status,
      message: "already_approved",
      idempotent: true,
    }
  } else if (soloEnabled) {
    approvalPath = "approveSequenceExecutionJobSolo"
    approvalResult = await approveSequenceExecutionJobSolo(admin, {
      jobId: HENRY_SCHEIN_JOB_ID,
      approvedBy: acting.userId,
      actorEmail: acting.email,
      platformAdmin: true,
    })
  } else {
    approvalPath = "approveSequenceExecutionJob"
    if (generationBefore?.status === "draft" && generationBefore.id) {
      const { approveGrowthAiCopilotGeneration } = await import("../lib/growth/run-ai-copilot-generation")
      await approveGrowthAiCopilotGeneration(admin, {
        generationId: generationBefore.id,
        actingUserId: acting.userId,
        actingUserEmail: acting.email,
      })
    }
    approvalResult = await approveSequenceExecutionJob(admin, {
      jobId: HENRY_SCHEIN_JOB_ID,
      approvedBy: acting.userId,
      actorEmail: acting.email,
    })
  }

  const jobAfter = await getSequenceExecutionJob(admin, HENRY_SCHEIN_JOB_ID)
  const generationAfter = stepBefore?.generation_id
    ? await fetchGrowthAiCopilotGenerationById(admin, stepBefore.generation_id as string)
    : null

  const approvedDueJobs = await listApprovedDueSequenceExecutionJobs(admin, 100)
  const schedulerVisible = approvedDueJobs.some((job) => job.id === HENRY_SCHEIN_JOB_ID)

  const dashboard = await fetchGrowthSequenceSafeExecutionDashboard(admin)
  const dashboardApproved = dashboard.jobs.some(
    (job) => job.id === HENRY_SCHEIN_JOB_ID && job.status === "approved",
  )

  const jobEvents = await listSequenceExecutionJobEvents(admin, HENRY_SCHEIN_JOB_ID, 25)

  const { count: outreachSentCount } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", HENRY_SCHEIN_LEAD_ID)
    .eq("status", "sent")

  const { data: draftAudit } = await admin
    .schema("growth")
    .from("apollo_primary_contact_enrollment_drafts")
    .select("source_attribution, outreach_sent")
    .eq("sequence_enrollment_id", HENRY_SCHEIN_ENROLLMENT_ID)
    .maybeSingle()

  const blockers: string[] = []

  if (!draftReview.body_chars) blockers.push("draft_review_missing_body")
  if (!approvalResult.ok) blockers.push(`approval_failed:${approvalResult.message ?? "unknown"}`)
  if (jobAfter?.status !== "approved") blockers.push(`job_not_approved:${jobAfter?.status ?? "missing"}`)
  if (!jobAfter?.humanApprovedAt) blockers.push("human_approval_timestamp_missing")
  if (jobAfter?.deliveryAttemptId) blockers.push("delivery_attempt_created")
  if (jobAfter?.status === "sent") blockers.push("job_sent")
  if ((outreachSentCount ?? 0) > 0) blockers.push("outreach_sent")
  if (!schedulerVisible && !dashboardApproved) blockers.push("approved_job_not_visible_to_scheduler")
  if (generationAfter?.status !== "approved") blockers.push(`generation_not_approved:${generationAfter?.status ?? "missing"}`)

  const expectedAttribution = buildApolloEnrollmentSourceAttributionChain()
  const draftAttribution = draftAudit?.source_attribution
  if (!Array.isArray(draftAttribution) || !expectedAttribution.every((v) => draftAttribution.includes(v))) {
    blockers.push("apollo_attribution_incomplete")
  }

  const certification = blockers.length === 0 ? "PASS" : "FAIL"

  const payload = {
    ok: certification === "PASS",
    qa_marker: EXECUTION_2_QA_MARKER,
    certification,
    blockers,
    pending_job_opened: {
      job_id: HENRY_SCHEIN_JOB_ID,
      status_before: jobBefore.status,
      enrollment_id: HENRY_SCHEIN_ENROLLMENT_ID,
      lead_id: HENRY_SCHEIN_LEAD_ID,
    },
    draft_review: draftReview,
    human_approval: {
      approval_path: approvalPath,
      solo_approval_enabled: soloEnabled,
      acting_user_id: acting.userId,
      result: approvalResult,
      job_status_after: jobAfter?.status ?? null,
      human_approved_at: jobAfter?.humanApprovedAt ?? null,
      human_approved_by: jobAfter?.humanApprovedBy ?? null,
      generation_status_after: generationAfter?.status ?? null,
      send_ready: jobAfter?.status === "approved" && Boolean(jobAfter?.humanApprovedAt),
      explicit_run_required: true,
    },
    safety: {
      delivery_attempt_id: jobAfter?.deliveryAttemptId ?? null,
      job_sent: jobAfter?.status === "sent",
      outreach_sent_count: outreachSentCount ?? 0,
      scheduler_send_executed: false,
      transport_delivery_triggered: false,
      apollo_outreach_sent_flag: draftAudit?.outreach_sent ?? null,
    },
    scheduler_readiness: {
      visible_in_approved_due_jobs: schedulerVisible,
      visible_in_execution_dashboard_approved: dashboardApproved,
      approved_due_job_count: approvedDueJobs.length,
      dashboard_ready_for_send_count: dashboard.jobs.filter(
        (job) => job.status === "approved" && job.humanApprovedAt,
      ).length,
    },
    apollo_attribution: {
      company_candidate_id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
      draft_source_attribution: draftAttribution ?? null,
      preserved: blockers.every((entry) => entry !== "apollo_attribution_incomplete"),
    },
    rollback_paths: {
      skip_before_send: {
        route: `/api/platform/growth/sequences/execution/jobs/${HENRY_SCHEIN_JOB_ID}/skip`,
        effect: "Marks job skipped; halts send path before transport.",
        ui: "Sequence Execution dashboard → Skip",
      },
      restore_after_skip: {
        route: `/api/platform/growth/sequences/execution/jobs/${HENRY_SCHEIN_JOB_ID}/restore`,
        effect: "Restores skipped job to pending_approval; clears humanApprovedAt.",
        ui: "Sequence Execution dashboard → Restore (skipped jobs only)",
      },
      generation_discard: {
        route: generationAfter?.id
          ? `/api/platform/growth/copilot/generations/${generationAfter.id}`
          : null,
        method: "DELETE",
        effect: "Discards AI copilot draft (CRM copilot panel).",
      },
      note: "There is no direct unapprove from approved — use Skip before Run/send, or Restore after Skip.",
    },
    job_audit_events: jobEvents.slice(0, 8).map((event) => ({
      event_type: event.eventType,
      title: event.title,
      description: event.description,
    })),
  }

  console.log(JSON.stringify(payload, null, 2))
  if (certification === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
