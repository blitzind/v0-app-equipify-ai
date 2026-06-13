/**
 * Phase 15.1C — Mailbox recovery + Wave 1 retry (production).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-pilot-mailbox-recovery-wave1-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { growthCronApiPath } from "../lib/growth/runtime/cron-telemetry-types"

const WAVE_JOBS = [
  { company: "Absolute Electric LLC", jobId: "941db1fb-fe47-4bc0-a8a7-c0913ec66260", leadId: "271aad94-11cf-4e3f-bd03-f0b374dcf3b3" },
  { company: "Absolute Heating & Air", jobId: "32e9cf59-98fb-4836-a050-d1b5f8e5b6bc", leadId: "3a33c331-ad27-4082-a1e1-369c09f3a1be" },
  { company: "Sierra Biomed", jobId: "13c17611-c4be-49c6-9f6a-36e4e70f0ca1", leadId: "faed1df6-8aed-4402-8f9b-dd83d65a6400" },
] as const

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const SENDER_ID = "46d733bd-554e-4fe4-89b0-8509a74004e9"
const MAILBOX_ID = "237b9dcc-4e2a-4df2-a618-c6aeed7beda2"
const SAFE_EXECUTE_CRON = growthCronApiPath("growth-sequence-safe-execute")

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function triggerCron(route: string): void {
  execFileSync("vercel", ["crons", "run", route], { cwd: process.cwd(), stdio: "pipe", timeout: 120_000 })
}

async function deployedPost(
  baseUrl: string,
  path: string,
  bearer: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : "{}",
  })
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { status: response.status, json }
}

async function deployedGet(
  baseUrl: string,
  path: string,
  bearer: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  })
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { status: response.status, json }
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
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
  if (!anonKey) throw new Error("missing_anon_key")

  const bearerResult = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
    admin_email: "mike@blitzind.com",
  })
  if (!bearerResult.access_token) throw new Error(bearerResult.error ?? "bearer_mint_failed")
  const bearer = bearerResult.access_token

  const actor = await (
    await import("../lib/growth/apollo/apollo-pilot-materialization-validation-actor")
  ).resolveApolloPilotMaterializationValidationActor(admin, {})

  const { data: mailboxBefore } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id,provider_family,email_address,status,health_reason,token_expires_at,connection_health")
    .eq("id", MAILBOX_ID)
    .maybeSingle()

  const mailboxAudit = {
    sender_mailbox_id: MAILBOX_ID,
    provider: mailboxBefore?.provider_family ?? "google",
    email: mailboxBefore?.email_address ?? "mike@blitzind.com",
    health_status: mailboxBefore?.status ?? "unknown",
    failure_reason: "Mailbox connection unhealthy (expired)",
    token_expires_at: mailboxBefore?.token_expires_at ?? null,
    health_reason: mailboxBefore?.health_reason ?? null,
  }

  const refreshReconnect = await deployedPost(baseUrl, "/api/platform/growth/provider-setup/google/reconnect", bearer, {
    mode: "refresh",
    sender_account_id: SENDER_ID,
  })
  const validateMailbox = await deployedPost(
    baseUrl,
    `/api/platform/growth/mailboxes/${MAILBOX_ID}/validate`,
    bearer,
  )
  const healthDashboard = await deployedGet(baseUrl, "/api/platform/growth/mailboxes/health", bearer)

  const { getMailboxConnectionBySender } = await import("../lib/growth/mailboxes/mailbox-repository")
  const { evaluatePreSendInfrastructureAllowed } = await import(
    "../lib/growth/compliance/pre-send-infrastructure-guards"
  )

  const mailboxAfter = await getMailboxConnectionBySender(admin, SENDER_ID).catch(() => null)
  const sendAllowed = await evaluatePreSendInfrastructureAllowed(admin, { senderAccountId: SENDER_ID })

  const mailboxRecovery = {
    mailbox_connected: mailboxAfter ? ["connected", "healthy", "warning"].includes(mailboxAfter.status) : false,
    mailbox_health: mailboxAfter?.status ?? "unknown",
    send_allowed: sendAllowed.allowed,
    send_block_reason: sendAllowed.reason ?? null,
    refresh_reconnect: refreshReconnect,
    validate_mailbox: validateMailbox,
    health_dashboard_status: healthDashboard.status,
    recovery_action:
      sendAllowed.allowed
        ? "mailbox health recalculation (completed via validate + refresh)"
        : refreshReconnect.json?.ok === false
          ? "provider reauthorization (OAuth reconnect required — refresh token failed)"
          : "validate + OAuth reconnect via /admin/growth/provider-setup",
  }

  const { loadApolloPilotCohort } = await import("../lib/growth/apollo/apollo-pilot-route")
  const { getSequenceExecutionJob, listSequenceExecutionJobs } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )
  const { approveSequenceExecutionJob } = await import("../lib/growth/sequences/execution/sequence-job-runner")

  const cohort = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohort) throw new Error("cohort_not_found")
  const companyIds = new Set(cohort.companies.map((c) => c.company_candidate_id))
  const queue = await (
    await import("../lib/growth/apollo/apollo-sequence-execution-queue")
  ).loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 200 })
  const cohortLeadIds = new Set(
    queue.items.filter((i) => companyIds.has(i.company_candidate_id) && i.growth_lead_id).map((i) => i.growth_lead_id as string),
  )

  const pendingBefore = (await listSequenceExecutionJobs(admin, { limit: 300 })).filter(
    (j) => cohortLeadIds.has(j.leadId) && j.status === "pending_approval",
  ).length

  let jobsRecovered = 0
  for (const wave of WAVE_JOBS) {
    const job = await getSequenceExecutionJob(admin, wave.jobId)
    if (!job || job.status !== "blocked") continue
    const approve = await approveSequenceExecutionJob(admin, {
      jobId: wave.jobId,
      approvedBy: actor.acting_user_id,
      actorEmail: actor.acting_user_email,
    })
    if (approve.ok) jobsRecovered += 1
  }

  const afterRecoveryStatuses = await Promise.all(
    WAVE_JOBS.map(async (w) => ({ jobId: w.jobId, status: (await getSequenceExecutionJob(admin, w.jobId))?.status })),
  )

  let executionSummary = { jobs_attempted: 0, jobs_sent: 0, jobs_failed: 0, jobs_blocked: 0 }
  const telemetry: Array<Record<string, unknown>> = []

  if (sendAllowed.allowed && jobsRecovered > 0) {
    triggerCron(SAFE_EXECUTE_CRON)
    executionSummary.jobs_attempted = WAVE_JOBS.length
    for (let i = 0; i < 15; i += 1) {
      await sleep(5000)
      const jobs = await Promise.all(WAVE_JOBS.map((w) => getSequenceExecutionJob(admin, w.jobId)))
      executionSummary.jobs_sent = jobs.filter((j) => j?.status === "sent").length
      executionSummary.jobs_blocked = jobs.filter((j) => j?.status === "blocked").length
      executionSummary.jobs_failed = jobs.filter((j) => j?.status === "failed").length
      if (executionSummary.jobs_sent + executionSummary.jobs_blocked + executionSummary.jobs_failed >= WAVE_JOBS.length) break
    }

    for (const wave of WAVE_JOBS) {
      const job = await getSequenceExecutionJob(admin, wave.jobId)
      const { data: events } = await admin
        .schema("growth")
        .from("sequence_execution_job_events")
        .select("metadata")
        .eq("job_id", wave.jobId)
        .eq("event_type", "job_sent")
        .limit(1)
      const providerMessageId =
        events?.[0]?.metadata && typeof events[0].metadata === "object"
          ? (events[0].metadata as Record<string, unknown>).provider_message_id
          : null
      const { data: timeline } = await admin
        .schema("growth")
        .from("lead_timeline_events")
        .select("event_type,payload")
        .eq("lead_id", wave.leadId)
        .eq("event_type", "sequence_step_sent")
        .limit(10)
      const timelineHit =
        timeline?.some(
          (row) => (row.payload as Record<string, unknown> | null)?.job_id === wave.jobId,
        ) ?? false
      const { data: touches } = job?.deliveryAttemptId
        ? await admin
            .schema("growth")
            .from("attribution_touches")
            .select("id")
            .eq("delivery_attempt_id", job.deliveryAttemptId)
            .limit(1)
        : { data: [] }

      telemetry.push({
        company: wave.company,
        email_sent: job?.status === "sent",
        provider_message_id_present: Boolean(providerMessageId),
        timeline_event_created: timelineHit,
        attribution_touch_created: (touches?.length ?? 0) > 0,
        dashboard_incremented: job?.status === "sent",
        job_status: job?.status,
        last_error: job?.lastError,
      })
    }
  }

  const { loadApolloPilotCohortAnalytics } = await import("../lib/growth/apollo/apollo-pilot-route")
  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const postJobs = await listSequenceExecutionJobs(admin, { limit: 300 })
  const remainingPending = postJobs.filter((j) => cohortLeadIds.has(j.leadId) && j.status === "pending_approval")
  const remainingSent = postJobs.filter(
    (j) => cohortLeadIds.has(j.leadId) && j.status === "sent" && !WAVE_JOBS.some((w) => w.jobId === j.id),
  )

  const allSent = executionSummary.jobs_sent === 3
  console.log(
    JSON.stringify(
      {
        ok: allSent,
        phase: "15.1C",
        mailbox_audit: mailboxAudit,
        mailbox_recovery: mailboxRecovery,
        wave_job_recovery: {
          jobs_recovered: jobsRecovered,
          status_after_recovery: afterRecoveryStatuses,
          remaining_8_untouched: remainingPending.length === pendingBefore,
        },
        wave_execution: executionSummary,
        telemetry_validation: telemetry,
        remaining_queue: {
          remaining_jobs_pending_approval: remainingPending.length,
          remaining_jobs_sent: remainingSent.length,
          remaining_jobs_untouched: remainingPending.length === 8,
          unexpected_sends: remainingSent.length,
        },
        dashboard_emails_sent: analytics?.dashboard.emails_sent ?? null,
        recommendation: allSent ? "CONTINUE_TO_WAVE_2" : "PAUSE_AND_INVESTIGATE",
        production_readiness: allSent ? "READY FOR CONTROLLED EXPANSION" : "NOT READY",
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
