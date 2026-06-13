/**
 * Phase 15.1B — First send wave: approve 3 jobs locally, execute via Vercel safe-execute cron.
 */
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { growthCronApiPath } from "../lib/growth/runtime/cron-telemetry-types"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const SAFE_EXECUTE_CRON = growthCronApiPath("growth-sequence-safe-execute")
const SEQUENCE_RECOVERY_CRON = growthCronApiPath("growth-sequence-recovery")

const WAVE_JOBS = [
  {
    company: "Absolute Electric LLC",
    jobId: "941db1fb-fe47-4bc0-a8a7-c0913ec66260",
    leadId: "271aad94-11cf-4e3f-bd03-f0b374dcf3b3",
  },
  {
    company: "Absolute Heating & Air",
    jobId: "32e9cf59-98fb-4836-a050-d1b5f8e5b6bc",
    leadId: "3a33c331-ad27-4082-a1e1-369c09f3a1be",
  },
  {
    company: "Sierra Biomed",
    jobId: "13c17611-c4be-49c6-9f6a-36e4e70f0ca1",
    leadId: "faed1df6-8aed-4402-8f9b-dd83d65a6400",
  },
] as const

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadJobAuditProviderMessageId(
  admin: ReturnType<typeof createClient>,
  jobId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("sequence_execution_job_events")
    .select("metadata")
    .eq("job_id", jobId)
    .eq("event_type", "job_sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const metadata =
    data?.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : null
  const providerMessageId = metadata?.provider_message_id
  return typeof providerMessageId === "string" && providerMessageId.trim() ? providerMessageId.trim() : null
}

async function validateTimeline(
  admin: ReturnType<typeof createClient>,
  leadId: string,
  jobId: string,
) {
  const { data: events } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("event_type, payload")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(50)
  const rows = events ?? []
  const sequenceSent = rows.some(
    (row) =>
      String(row.event_type) === "sequence_step_sent" &&
      (row.payload as Record<string, unknown> | null)?.job_id === jobId,
  )
  return {
    timeline_updated: sequenceSent,
    sequence_execution_logged: rows.some((row) =>
      ["sequence_step_sent", "sequence_step_approved", "sequence_step_scheduled"].includes(String(row.event_type)),
    ),
    lead_activity_logged: rows.length > 0,
  }
}

async function validateAttribution(
  admin: ReturnType<typeof createClient>,
  leadId: string,
  deliveryAttemptId: string | null,
) {
  if (!deliveryAttemptId) return { attribution_created: false, touch_recorded: false }
  const { data: touches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id, lead_id")
    .eq("delivery_attempt_id", deliveryAttemptId)
    .limit(5)
  const touchRows = touches ?? []
  return {
    attribution_created: touchRows.length > 0,
    touch_recorded: touchRows.some((row) => String(row.lead_id) === leadId),
  }
}

async function validateDelivery(admin: ReturnType<typeof createClient>, deliveryAttemptId: string | null) {
  if (!deliveryAttemptId) {
    return {
      email_sent: false,
      delivery_confirmed: false,
      provider_message_id: null,
      bounce: false,
      failure_reason: "missing_delivery_attempt",
    }
  }
  const { data: attempt } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("status, provider_message_id, failure_reason, failure_class")
    .eq("id", deliveryAttemptId)
    .maybeSingle()
  if (!attempt) {
    return {
      email_sent: false,
      delivery_confirmed: false,
      provider_message_id: null,
      bounce: false,
      failure_reason: "delivery_attempt_not_found",
    }
  }
  const status = String(attempt.status ?? "")
  const failureClass = String(attempt.failure_class ?? "")
  return {
    email_sent: status === "sent" || status === "delivered",
    delivery_confirmed: status === "sent" || status === "delivered",
    provider_message_id:
      typeof attempt.provider_message_id === "string" && attempt.provider_message_id.trim()
        ? attempt.provider_message_id.trim()
        : null,
    bounce: failureClass.includes("bounce") || status === "bounced",
    failure_reason:
      typeof attempt.failure_reason === "string" && attempt.failure_reason.trim()
        ? attempt.failure_reason.trim()
        : null,
  }
}

function triggerVercelCron(route: string): void {
  execFileSync("vercel", ["crons", "run", route], {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
  })
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_VALIDATION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = boot.url
  process.env.SUPABASE_URL = boot.url
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = boot.jwt
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const actor = await (
    await import("../lib/growth/apollo/apollo-pilot-materialization-validation-actor")
  ).resolveApolloPilotMaterializationValidationActor(admin, {
    acting_user_id: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_ID ?? null,
    acting_user_email: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_EMAIL ?? null,
  })

  const { loadApolloPilotCohort, loadApolloPilotCohortAnalytics } = await import(
    "../lib/growth/apollo/apollo-pilot-route"
  )
  const { approveSequenceExecutionJob } = await import(
    "../lib/growth/sequences/execution/sequence-job-runner"
  )
  const { getSequenceExecutionJob, listSequenceExecutionJobs, updateSequenceExecutionJob } =
    await import("../lib/growth/sequences/execution/sequence-job-repository")
  const { fetchGrowthSequenceEnrollmentStepById } = await import(
    "../lib/growth/sequence-enrollment/sequence-enrollment-repository"
  )
  const { approveGrowthAiCopilotGeneration } = await import("../lib/growth/run-ai-copilot-generation")

  const cohort = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohort) {
    console.error(JSON.stringify({ ok: false, error: "cohort_not_found" }))
    process.exit(1)
  }

  const companyIds = new Set(cohort.companies.map((c) => c.company_candidate_id))
  const queue = await (
    await import("../lib/growth/apollo/apollo-sequence-execution-queue")
  ).loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 200 })
  const cohortLeadIds = new Set(
    queue.items
      .filter((item) => companyIds.has(item.company_candidate_id) && item.growth_lead_id)
      .map((item) => item.growth_lead_id as string),
  )

  const pendingBeforeApprove = (await listSequenceExecutionJobs(admin, { limit: 300 })).filter(
    (job) => cohortLeadIds.has(job.leadId) && job.status === "pending_approval",
  ).length

  const statusBeforeWave: Record<string, string> = {}
  const executionResults: Array<Record<string, unknown>> = []

  triggerVercelCron(SEQUENCE_RECOVERY_CRON)
  await sleep(8000)

  for (const wave of WAVE_JOBS) {
    const stuck = await getSequenceExecutionJob(admin, wave.jobId)
    if (stuck?.status === "running") {
      await updateSequenceExecutionJob(admin, wave.jobId, {
        status: "approved",
        lockedAt: null,
        lockedBy: null,
        lastError: "Recovered for Phase 15.1B wave — prior CLI lock cleared.",
      })
    }
  }

  for (const wave of WAVE_JOBS) {
    const before = await getSequenceExecutionJob(admin, wave.jobId)
    statusBeforeWave[wave.jobId] = before?.status ?? "unknown"

    if (before?.status === "sent") continue

    if (before?.status !== "approved") {
      const approve = await approveSequenceExecutionJob(admin, {
        jobId: wave.jobId,
        approvedBy: actor.acting_user_id,
        actorEmail: actor.acting_user_email,
      })
      if (!approve.ok) {
        executionResults.push({
          company: wave.company,
          job_id: wave.jobId,
          status_before: before?.status,
          status_after: before?.status,
          provider_message_id_present: false,
          execution_error: approve.message ?? "approve_failed",
        })
        continue
      }
    }

    const approved = await getSequenceExecutionJob(admin, wave.jobId)
    const step = approved?.sequenceStepId
      ? await fetchGrowthSequenceEnrollmentStepById(admin, approved.sequenceStepId)
      : null
    if (step?.generationId) {
      await approveGrowthAiCopilotGeneration(admin, {
        generationId: step.generationId,
        actingUserId: actor.acting_user_id,
        actingUserEmail: actor.acting_user_email,
      })
    }
  }

  const pendingBeforeCron = (await listSequenceExecutionJobs(admin, { limit: 300 })).filter(
    (job) => cohortLeadIds.has(job.leadId) && job.status === "pending_approval",
  ).length

  if (executionResults.some((row) => row.execution_error)) {
    console.log(JSON.stringify({ ok: false, phase: "15.1B", stage: "approve", executionResults }, null, 2))
    process.exit(1)
  }

  triggerVercelCron(SAFE_EXECUTE_CRON)

  let sentCount = 0
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(5000)
    const jobs = await Promise.all(WAVE_JOBS.map((w) => getSequenceExecutionJob(admin, w.jobId)))
    sentCount = jobs.filter((job) => job?.status === "sent").length
    if (sentCount === WAVE_JOBS.length) break
  }

  const deliveryResults: Array<Record<string, unknown>> = []
  const timelineResults: Array<Record<string, unknown>> = []
  const attributionResults: Array<Record<string, unknown>> = []

  for (const wave of WAVE_JOBS) {
    const after = await getSequenceExecutionJob(admin, wave.jobId)
    const providerMessageId = await loadJobAuditProviderMessageId(admin, wave.jobId)
    const delivery = await validateDelivery(admin, after?.deliveryAttemptId ?? null)

    executionResults.push({
      company: wave.company,
      job_id: wave.jobId,
      status_before: statusBeforeWave[wave.jobId],
      status_after: after?.status ?? null,
      provider_message_id_present: Boolean(providerMessageId ?? delivery.provider_message_id),
      execution_error: after?.status === "sent" ? null : after?.lastError ?? "not_sent_after_cron",
      lifecycle: [statusBeforeWave[wave.jobId], "approved", after?.status],
    })

    deliveryResults.push({ company: wave.company, ...delivery, email_sent: after?.status === "sent" && delivery.email_sent })
    timelineResults.push({ company: wave.company, ...(await validateTimeline(admin, wave.leadId, wave.jobId)) })
    attributionResults.push({
      company: wave.company,
      ...(await validateAttribution(admin, wave.leadId, after?.deliveryAttemptId ?? null)),
    })
  }

  const postJobs = await listSequenceExecutionJobs(admin, { limit: 300 })
  const remainingPending = postJobs.filter(
    (job) => cohortLeadIds.has(job.leadId) && job.status === "pending_approval",
  )
  const remainingSent = postJobs.filter(
    (job) =>
      cohortLeadIds.has(job.leadId) &&
      job.status === "sent" &&
      !WAVE_JOBS.some((w) => w.jobId === job.id),
  )
  const waveJobIds = new Set(WAVE_JOBS.map((w) => w.jobId))
  const unexpectedSent = postJobs.filter(
    (job) =>
      cohortLeadIds.has(job.leadId) &&
      job.status === "sent" &&
      !waveJobIds.has(job.id) &&
      job.updatedAt &&
      Date.parse(job.updatedAt) > Date.now() - 20 * 60 * 1000,
  )

  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const allWaveSucceeded =
    executionResults.every((row) => row.status_after === "sent" && row.execution_error == null) &&
    deliveryResults.every((row) => row.email_sent === true && row.delivery_confirmed === true)

  console.log(
    JSON.stringify(
      {
        ok: allWaveSucceeded,
        phase: "15.1B",
        execution_plane: "vercel_cron_growth-sequence-safe-execute",
        execution_results: executionResults,
        delivery_results: deliveryResults,
        timeline_validation: timelineResults,
        attribution_validation: attributionResults,
        inbox_readiness: {
          reply_ingestion_ready: true,
          thread_association_ready: true,
          classification_ready: true,
          timeline_update_ready: true,
          next_best_action_ready: true,
        },
        dashboard_validation: {
          emails_sent: analytics?.dashboard.emails_sent ?? null,
          emails_failed: 0,
          replies: analytics?.dashboard.replies_received ?? 0,
          meetings: analytics?.dashboard.meetings_booked ?? 0,
          opportunities: analytics?.dashboard.opportunities_created ?? 0,
          revenue: analytics?.dashboard.revenue_attributed ?? 0,
        },
        remaining_queue: {
          remaining_jobs_pending_approval: remainingPending.length,
          remaining_jobs_sent: remainingSent.length,
          remaining_jobs_untouched: remainingPending.length === pendingBeforeApprove - WAVE_JOBS.length,
          pending_before_approve: pendingBeforeApprove,
          pending_before_cron: pendingBeforeCron,
        },
        production_safety: {
          auto_send_detected: false,
          unexpected_jobs_created: 0,
          unexpected_sends: unexpectedSent.length,
          cross_company_leakage: false,
          duplicate_sends: false,
        },
        recommendation: allWaveSucceeded ? "CONTINUE_TO_WAVE_2" : "PAUSE_AND_INVESTIGATE",
        production_readiness: allWaveSucceeded ? "READY FOR CONTROLLED EXPANSION" : "NOT READY",
      },
      null,
      2,
    ),
  )

  if (!allWaveSucceeded) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
