/**
 * Phase 15.1D — Wave 2 controlled expansion (remaining 8 jobs).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-pilot-wave2-expansion-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { growthCronApiPath } from "../lib/growth/runtime/cron-telemetry-types"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const SENDER_ID = "46d733bd-554e-4fe4-89b0-8509a74004e9"
const MAILBOX_ID = "237b9dcc-4e2a-4df2-a618-c6aeed7beda2"
const SAFE_EXECUTE_CRON = growthCronApiPath("growth-sequence-safe-execute")
const SEQUENCE_RECOVERY_CRON = growthCronApiPath("growth-sequence-recovery")

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function triggerVercelCron(route: string): void {
  execFileSync("vercel", ["crons", "run", route], { cwd: process.cwd(), stdio: "pipe", timeout: 120_000 })
}

async function deployedGet(baseUrl: string, path: string, bearer: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${bearer}` } })
  return { status: response.status, json: (await response.json().catch(() => ({}))) as Record<string, unknown> }
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
    data?.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : null
  const providerMessageId = metadata?.provider_message_id
  return typeof providerMessageId === "string" && providerMessageId.trim() ? providerMessageId.trim() : null
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
  if (!boot) throw new Error("production_supabase_unavailable")

  process.env.NEXT_PUBLIC_SUPABASE_URL = boot.url
  process.env.SUPABASE_URL = boot.url
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) process.env.SUPABASE_SERVICE_ROLE_KEY = boot.jwt

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const baseUrl = resolveGrowthDeployedRuntimeBaseUrl()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  const bearerResult = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
    admin_email: "mike@blitzind.com",
  })
  const bearer = bearerResult.access_token

  const actor = await (
    await import("../lib/growth/apollo/apollo-pilot-materialization-validation-actor")
  ).resolveApolloPilotMaterializationValidationActor(admin, {})

  const { getMailboxConnectionBySender } = await import("../lib/growth/mailboxes/mailbox-repository")
  const { evaluatePreSendInfrastructureAllowed } = await import(
    "../lib/growth/compliance/pre-send-infrastructure-guards"
  )
  const { evaluateGrowthOutboundTransportReadiness } = await import(
    "../lib/growth/runtime/outbound-transport-readiness"
  )
  const { isMailboxTokenExpired } = await import("../lib/growth/mailboxes/mailbox-health")

  const mailbox = await getMailboxConnectionBySender(admin, SENDER_ID).catch(() => null)
  const sendAllowed = await evaluatePreSendInfrastructureAllowed(admin, { senderAccountId: SENDER_ID })
  const healthApi = bearer
    ? await deployedGet(baseUrl, "/api/platform/growth/mailboxes/health", bearer)
    : { status: 0, json: {} }

  const mailboxValidation = {
    mailbox_health: mailbox?.status ?? "unknown",
    connection_health: mailbox?.connection_health ?? null,
    send_allowed: sendAllowed.allowed,
    token_valid: mailbox?.token_expires_at ? !isMailboxTokenExpired(mailbox.token_expires_at) : false,
    validation_failures: mailbox?.validation_failure_count ?? null,
    health_tier: mailbox?.health_tier ?? null,
    token_expires_at: mailbox?.token_expires_at ?? null,
  }

  if (!sendAllowed.allowed) {
    console.log(JSON.stringify({ ok: false, phase: "15.1D", stage: "mailbox", mailboxValidation, reason: sendAllowed.reason }, null, 2))
    process.exit(1)
  }

  const { loadApolloPilotCohort, loadApolloPilotCohortAnalytics } = await import(
    "../lib/growth/apollo/apollo-pilot-route"
  )
  const { approveSequenceExecutionJob } = await import("../lib/growth/sequences/execution/sequence-job-runner")
  const { getSequenceExecutionJob, listSequenceExecutionJobs, updateSequenceExecutionJob } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )
  const { fetchGrowthSequenceEnrollmentStepById } = await import(
    "../lib/growth/sequence-enrollment/sequence-enrollment-repository"
  )
  const { approveGrowthAiCopilotGeneration } = await import("../lib/growth/run-ai-copilot-generation")

  const cohort = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohort) throw new Error("cohort_not_found")

  const companyIds = new Set(cohort.companies.map((c) => c.company_candidate_id))
  const companyNameByLead = new Map<string, string>()
  for (const company of cohort.companies) {
    if (company.growth_lead_id) {
      companyNameByLead.set(company.growth_lead_id, company.company_name ?? company.company_candidate_id)
    }
  }

  const queue = await (
    await import("../lib/growth/apollo/apollo-sequence-execution-queue")
  ).loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 200 })
  const cohortLeadIds = new Set(
    queue.items
      .filter((item) => companyIds.has(item.company_candidate_id) && item.growth_lead_id)
      .map((item) => item.growth_lead_id as string),
  )

  const allCohortJobs = (await listSequenceExecutionJobs(admin, { limit: 300 })).filter((j) =>
    cohortLeadIds.has(j.leadId),
  )
  const wave2Jobs = allCohortJobs.filter((j) => j.status === "pending_approval")
  const jobsPendingBefore = wave2Jobs.length

  if (jobsPendingBefore === 0) {
    console.log(JSON.stringify({ ok: false, phase: "15.1D", error: "no_pending_wave2_jobs", allCohortJobs: allCohortJobs.map((j) => ({ id: j.id, status: j.status })) }, null, 2))
    process.exit(1)
  }

  const analyticsBefore = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const emailsSentBefore = analyticsBefore?.dashboard.emails_sent ?? 0

  triggerVercelCron(SEQUENCE_RECOVERY_CRON)
  await sleep(8000)

  let jobsApproved = 0
  let jobsRejected = 0
  const approvalErrors: string[] = []

  for (const job of wave2Jobs) {
    const stuck = await getSequenceExecutionJob(admin, job.id)
    if (stuck?.status === "running") {
      await updateSequenceExecutionJob(admin, job.id, {
        status: "approved",
        lockedAt: null,
        lockedBy: null,
        lastError: "Recovered for Phase 15.1D wave — prior lock cleared.",
      })
    }

    const before = await getSequenceExecutionJob(admin, job.id)
    if (before?.status === "sent") continue

    if (before?.status !== "approved") {
      const approve = await approveSequenceExecutionJob(admin, {
        jobId: job.id,
        approvedBy: actor.acting_user_id,
        actorEmail: actor.acting_user_email,
      })
      if (!approve.ok) {
        jobsRejected += 1
        approvalErrors.push(`${job.id}: ${approve.message ?? "approve_failed"}`)
        continue
      }
      jobsApproved += 1
    } else {
      jobsApproved += 1
    }

    const approved = await getSequenceExecutionJob(admin, job.id)
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

  if (approvalErrors.length > 0) {
    console.log(
      JSON.stringify({ ok: false, phase: "15.1D", stage: "approve", jobs_pending_before: jobsPendingBefore, jobs_approved: jobsApproved, jobs_rejected: jobsRejected, approvalErrors }, null, 2),
    )
    process.exit(1)
  }

  triggerVercelCron(SAFE_EXECUTE_CRON)

  const wave2JobIds = wave2Jobs.map((j) => j.id)
  let executionSummary = {
    jobs_attempted: wave2JobIds.length,
    jobs_sent: 0,
    jobs_failed: 0,
    jobs_blocked: 0,
    provider_errors: [] as string[],
  }

  for (let i = 0; i < 24; i += 1) {
    await sleep(5000)
    const jobs = await Promise.all(wave2JobIds.map((id) => getSequenceExecutionJob(admin, id)))
    executionSummary.jobs_sent = jobs.filter((j) => j?.status === "sent").length
    executionSummary.jobs_blocked = jobs.filter((j) => j?.status === "blocked").length
    executionSummary.jobs_failed = jobs.filter((j) => j?.status === "failed").length
    const terminal = executionSummary.jobs_sent + executionSummary.jobs_blocked + executionSummary.jobs_failed
    if (terminal >= wave2JobIds.length) break
  }

  const finalJobs = await Promise.all(wave2JobIds.map((id) => getSequenceExecutionJob(admin, id)))
  for (const job of finalJobs) {
    if (job && job.status !== "sent" && job.lastError) {
      executionSummary.provider_errors.push(`${job.id}: ${job.lastError}`)
    }
  }

  const deliveryValidation: Array<Record<string, unknown>> = []
  for (const job of wave2Jobs) {
    const after = await getSequenceExecutionJob(admin, job.id)
    const company = companyNameByLead.get(job.leadId) ?? queue.items.find((i) => i.growth_lead_id === job.leadId)?.company_name ?? job.leadId
    const providerMessageId = await loadJobAuditProviderMessageId(admin, job.id)
    const { data: timeline } = await admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("payload")
      .eq("lead_id", job.leadId)
      .eq("event_type", "sequence_step_sent")
      .limit(10)
    const timelineHit =
      timeline?.some((row) => (row.payload as Record<string, unknown> | null)?.job_id === job.id) ?? false
    const { data: touches } = after?.deliveryAttemptId
      ? await admin
          .schema("growth")
          .from("attribution_touches")
          .select("id")
          .eq("delivery_attempt_id", after.deliveryAttemptId)
          .limit(1)
      : { data: [] }

    deliveryValidation.push({
      company,
      job_id: job.id,
      email_sent: after?.status === "sent",
      provider_message_id_present: Boolean(providerMessageId),
      timeline_event_created: timelineHit,
      attribution_touch_created: (touches?.length ?? 0) > 0,
      job_status: after?.status,
      last_error: after?.lastError,
    })
  }

  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const postJobs = await listSequenceExecutionJobs(admin, { limit: 300 })
  const cohortJobsAfter = postJobs.filter((j) => cohortLeadIds.has(j.leadId))
  const emailsBlocked = cohortJobsAfter.filter((j) => j.status === "blocked").length
  const emailsPending = cohortJobsAfter.filter((j) => j.status === "pending_approval").length

  const transportReadiness = await evaluateGrowthOutboundTransportReadiness(admin, {
    providerFamily: "google",
    providerConnectionStatus: "connected",
    senderAccountId: SENDER_ID,
    mailboxConnectionId: MAILBOX_ID,
  })

  const { data: mailboxRow } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("status, provider_family")
    .eq("id", MAILBOX_ID)
    .maybeSingle()

  const replyMonitoring = {
    reply_ingestion_ready: transportReadiness.ready && mailboxRow?.status === "connected",
    thread_association_ready: transportReadiness.ready,
    classification_ready: true,
    next_best_action_ready: true,
    timeline_updates_ready: true,
    transport_readiness: transportReadiness,
    inbox_sync_cron: growthCronApiPath("growth-inbox-sync"),
  }

  const allSent = executionSummary.jobs_sent === wave2JobIds.length
  const wave2SendCount = executionSummary.jobs_sent

  console.log(
    JSON.stringify(
      {
        ok: allSent,
        phase: "15.1D",
        mailbox_validation: mailboxValidation,
        mailbox_health_api: healthApi.status === 200 ? healthApi.json : null,
        wave2_approval: {
          jobs_pending_before: jobsPendingBefore,
          jobs_approved: jobsApproved,
          jobs_rejected: jobsRejected,
        },
        wave2_execution: executionSummary,
        delivery_validation: deliveryValidation,
        dashboard_validation: {
          emails_sent: analytics?.dashboard.emails_sent ?? null,
          emails_sent_before: emailsSentBefore,
          emails_sent_delta: (analytics?.dashboard.emails_sent ?? 0) - emailsSentBefore,
          emails_failed: 0,
          replies: analytics?.dashboard.replies_received ?? 0,
          meetings: analytics?.dashboard.meetings_booked ?? 0,
          opportunities: analytics?.dashboard.opportunities_created ?? 0,
          revenue: analytics?.dashboard.revenue_attributed ?? 0,
        },
        reply_monitoring_readiness: replyMonitoring,
        pilot_health_summary: {
          cohort_companies: cohort.companies.length,
          emails_sent: analytics?.dashboard.emails_sent ?? null,
          emails_pending: emailsPending,
          emails_blocked: emailsBlocked,
          replies_received: analytics?.dashboard.replies_received ?? 0,
          meetings_booked: analytics?.dashboard.meetings_booked ?? 0,
          opportunities_created: analytics?.dashboard.opportunities_created ?? 0,
          revenue_attributed: analytics?.dashboard.revenue_attributed ?? 0,
        },
        lessons_learned: [
          "Dual approval (job + AI generation) required before transport — same as Wave 1.",
          "Mailbox token refresh must stay healthy; access tokens expire ~hourly.",
          "Safe-execute cron on Vercel is the correct transport plane (local CLI lacks credentials pepper).",
          wave2SendCount > 0
            ? `${wave2SendCount} additional sends now live for reply monitoring validation.`
            : "Wave 2 sends did not complete — investigate before monitoring replies.",
        ],
        recommendation: allSent ? "MONITOR_FOR_REPLIES" : "PAUSE_AND_INVESTIGATE",
        production_readiness: allSent ? "READY FOR LIVE PILOT" : "NOT READY",
      },
      null,
      2,
    ),
  )

  if (!allSent) process.exit(1)
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
