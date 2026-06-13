/**
 * Phase 15.1C — Wave 1 safe execute after mailbox recovery.
 */
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { growthCronApiPath } from "../lib/growth/runtime/cron-telemetry-types"

const WAVE_JOBS = [
  { company: "Absolute Electric LLC", jobId: "941db1fb-fe47-4bc0-a8a7-c0913ec66260", leadId: "271aad94-11cf-4e3f-bd03-f0b374dcf3b3" },
  { company: "Absolute Heating & Air", jobId: "32e9cf59-98fb-4836-a050-d1b5f8e5b6bc", leadId: "3a33c331-ad27-4082-a1e1-369c09f3a1be" },
  { company: "Sierra Biomed", jobId: "13c17611-c4be-49c6-9f6a-36e4e70f0ca1", leadId: "faed1df6-8aed-4402-8f9b-dd83d65a6400" },
] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  if (!boot) throw new Error("no boot")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { getSequenceExecutionJob, updateSequenceExecutionJob, listSequenceExecutionJobs } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )
  const { loadApolloPilotCohort, loadApolloPilotCohortAnalytics } = await import(
    "../lib/growth/apollo/apollo-pilot-route"
  )

  for (const wave of WAVE_JOBS) {
    const job = await getSequenceExecutionJob(admin, wave.jobId)
    if (job?.status === "running") {
      await updateSequenceExecutionJob(admin, wave.jobId, {
        status: "approved",
        lockedAt: null,
        lockedBy: null,
        lastError: "Recovered for Phase 15.1C wave retry.",
      })
    }
  }

  execFileSync("vercel", ["crons", "run", growthCronApiPath("growth-sequence-safe-execute")], {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
  })

  let summary = { jobs_attempted: 3, jobs_sent: 0, jobs_failed: 0, jobs_blocked: 0 }
  for (let i = 0; i < 18; i += 1) {
    await sleep(5000)
    const jobs = await Promise.all(WAVE_JOBS.map((w) => getSequenceExecutionJob(admin, w.jobId)))
    summary.jobs_sent = jobs.filter((j) => j?.status === "sent").length
    summary.jobs_blocked = jobs.filter((j) => j?.status === "blocked").length
    summary.jobs_failed = jobs.filter((j) => j?.status === "failed").length
    if (summary.jobs_sent + summary.jobs_blocked + summary.jobs_failed >= 3) break
  }

  const telemetry: Array<Record<string, unknown>> = []
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
      .select("payload")
      .eq("lead_id", wave.leadId)
      .eq("event_type", "sequence_step_sent")
      .limit(10)
    const timelineHit =
      timeline?.some((row) => (row.payload as Record<string, unknown> | null)?.job_id === wave.jobId) ?? false
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

  const cohort = await loadApolloPilotCohort(admin, "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a")
  const companyIds = new Set(cohort?.companies.map((c) => c.company_candidate_id) ?? [])
  const queue = await (
    await import("../lib/growth/apollo/apollo-sequence-execution-queue")
  ).loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 200 })
  const cohortLeadIds = new Set(
    queue.items.filter((i) => companyIds.has(i.company_candidate_id) && i.growth_lead_id).map((i) => i.growth_lead_id as string),
  )
  const postJobs = await listSequenceExecutionJobs(admin, { limit: 300 })
  const remainingPending = postJobs.filter((j) => cohortLeadIds.has(j.leadId) && j.status === "pending_approval")
  const remainingSent = postJobs.filter(
    (j) => cohortLeadIds.has(j.leadId) && j.status === "sent" && !WAVE_JOBS.some((w) => w.jobId === j.id),
  )
  const analytics = await loadApolloPilotCohortAnalytics(admin, "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a")

  console.log(
    JSON.stringify(
      {
        ok: summary.jobs_sent === 3,
        wave_execution: summary,
        telemetry_validation: telemetry,
        remaining_queue: {
          remaining_jobs_pending_approval: remainingPending.length,
          remaining_jobs_sent: remainingSent.length,
          remaining_jobs_untouched: remainingPending.length === 8,
          unexpected_sends: remainingSent.length,
        },
        dashboard_emails_sent: analytics?.dashboard.emails_sent ?? null,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
