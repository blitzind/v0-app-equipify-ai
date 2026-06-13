/**
 * Phase 15.1A — Operator pilot execution (production Supabase + official library paths).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-pilot-operator-execution-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

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

  const base_url =
    process.env.GROWTH_ENGINE_PUBLIC_BASE_URL?.trim() ||
    resolveGrowthDeployedRuntimeBaseUrl() ||
    "https://app.equipify.ai"

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { loadApolloPilotCohort, loadApolloPilotCohortAnalytics, applyApolloPilotCohortAction } =
    await import("../lib/growth/apollo/apollo-pilot-route")
  const { loadApolloSequenceExecutionQueue, approveApolloSequenceExecutionDrafts } = await import(
    "../lib/growth/apollo/apollo-sequence-execution-queue"
  )
  const { planSequenceExecutionJobs } = await import(
    "../lib/growth/sequences/execution/sequence-job-planner"
  )
  const { runGrowthSequenceScheduler } = await import(
    "../lib/growth/sequence-enrollment/run-sequence-scheduler"
  )
  const { isGrowthOutboundStandaloneMode } = await import("../lib/growth/runtime/outbound-mode")
  const { resolveApolloPilotMaterializationValidationActor } = await import(
    "../lib/growth/apollo/apollo-pilot-materialization-validation-actor"
  )
  const { listSequenceExecutionJobs } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )

  const actor = await resolveApolloPilotMaterializationValidationActor(admin, {
    acting_user_id: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_ID ?? null,
    acting_user_email: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_EMAIL ?? null,
  })

  const cohortBefore = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohortBefore) {
    console.error(JSON.stringify({ ok: false, error: "cohort_not_found" }))
    process.exit(1)
  }

  const companyIds = new Set(cohortBefore.companies.map((c) => c.company_candidate_id))
  const leadIds = new Set<string>()

  for (const company of cohortBefore.companies) {
    const { data } = await admin
      .schema("growth")
      .from("leads")
      .select("id")
      .eq("company_candidate_id", company.company_candidate_id)
      .limit(5)
    for (const row of data ?? []) {
      const id = (row as { id?: string }).id
      if (id) leadIds.add(id)
    }
  }

  const queueSnapshot = await loadApolloSequenceExecutionQueue(admin, {
    status: "pending_draft_approval",
    limit: 100,
  })

  const pendingDrafts = queueSnapshot.items.filter((item) =>
    companyIds.has(item.company_candidate_id),
  )

  const draftResults: Array<Record<string, unknown>> = []
  let draftsApproved = 0
  let draftsRejected = 0

  for (const item of pendingDrafts) {
    const approve = await approveApolloSequenceExecutionDrafts(admin, {
      candidate_id: item.candidate_id,
      approver_user_id: actor.acting_user_id,
      approver_email: actor.acting_user_email,
      note: "Phase 15.1A operator pilot execution — draft approved after 15.0F validation.",
    })

    if (approve.ok) {
      draftsApproved += 1
      draftResults.push({
        candidate_id: item.candidate_id,
        company: item.company_name,
        ok: true,
        status: approve.status,
      })
    } else {
      draftsRejected += 1
      draftResults.push({
        candidate_id: item.candidate_id,
        company: item.company_name,
        ok: false,
        error: approve.error ?? "approve_failed",
      })
    }
  }

  const cohortStatusBefore = cohortBefore.cohort.status
  let activatedCohort = cohortBefore.cohort
  let activateOk = false
  let activateError: string | null = null

  try {
    activatedCohort = await applyApolloPilotCohortAction(admin, {
      cohort_id: COHORT_ID,
      action: "activate",
    })
    activateOk = true
  } catch (error) {
    activateError = error instanceof Error ? error.message : String(error)
  }

  let planOk = false
  let planResult: Record<string, unknown> | null = null

  try {
    if (isGrowthOutboundStandaloneMode()) {
      const scheduler = await runGrowthSequenceScheduler(admin, {
        actingUserId: actor.acting_user_id,
        actingUserEmail: actor.acting_user_email,
        limit: 100,
        dryRun: false,
      })
      planOk = true
      planResult = { delegatedToScheduler: true, ...scheduler }
    } else {
      const planned = await planSequenceExecutionJobs(admin, {
        limit: 100,
        actingUserId: actor.acting_user_id,
      })
      planOk = true
      planResult = planned as unknown as Record<string, unknown>
    }
  } catch (error) {
    planResult = { error: error instanceof Error ? error.message : String(error) }
  }

  const allJobs = await listSequenceExecutionJobs(admin, { limit: 200 })
  const cohortJobs = allJobs.filter((job) => leadIds.has(job.leadId))

  const jobsByStatus = cohortJobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1
    return acc
  }, {})

  const jobsPendingApproval = cohortJobs.filter((job) => job.status === "pending_approval")
  const jobsApproved = cohortJobs.filter((job) => job.status === "approved")

  const channelCounts = cohortJobs.reduce(
    (acc, job) => {
      const channel = String(job.channel ?? "email").toLowerCase()
      if (channel.includes("sms")) acc.sms += 1
      else if (channel.includes("voice") || channel.includes("call")) acc.voice += 1
      else acc.email += 1
      return acc
    },
    { email: 0, sms: 0, voice: 0 },
  )

  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const cohortAfter = await loadApolloPilotCohort(admin, COHORT_ID)

  const executionReadyQueue = await loadApolloSequenceExecutionQueue(admin, {
    status: "execution_ready",
    limit: 100,
  })

  const executionReadyCount = executionReadyQueue.items.filter((item) =>
    companyIds.has(item.company_candidate_id),
  ).length

  const jobsCreated =
    typeof planResult?.created === "number"
      ? planResult.created
      : typeof planResult?.jobs_created === "number"
        ? planResult.jobs_created
        : cohortJobs.length

  console.log(
    JSON.stringify(
      {
        ok: draftsRejected === 0 && activateOk,
        phase: "15.1A",
        base_url,
        operator_actor: actor,
        draft_approval: {
          drafts_reviewed: pendingDrafts.length,
          drafts_approved: draftsApproved,
          drafts_rejected: draftsRejected,
          results: draftResults,
        },
        cohort_activation: {
          cohort_status_before: cohortStatusBefore,
          cohort_status_after: cohortAfter?.cohort.status ?? activatedCohort.status,
          processing_allowed: analytics?.processing_allowed ?? false,
          activate_ok: activateOk,
          activate_error: activateError,
        },
        execution_planning: {
          execution_candidates: executionReadyCount || draftsApproved,
          jobs_created: jobsCreated,
          emails_scheduled: channelCounts.email,
          sms_scheduled: channelCounts.sms,
          voice_scheduled: channelCounts.voice,
          plan_ok: planOk,
          plan_result: planResult,
          job_status_counts: jobsByStatus,
        },
        approval_queue: {
          job_approvals_required: true,
          jobs_pending_approval: jobsPendingApproval.length,
          auto_send_possible: false,
        },
        safe_execute_readiness: {
          safe_execute_ready: jobsApproved.length > 0 || jobsPendingApproval.length > 0,
          human_confirmation_required: true,
          approved_jobs_ready_to_send: jobsApproved.length,
          pending_jobs_awaiting_approval: jobsPendingApproval.length,
        },
        production_readiness:
          draftsRejected === 0 && activateOk && cohortAfter?.cohort.status === "active"
            ? "READY FOR PILOT LAUNCH"
            : "NOT READY",
      },
      null,
      2,
    ),
  )

  if (draftsRejected > 0 || !activateOk) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
