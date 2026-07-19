/**
 * GE-AIOS-MULTI-LEAD-INTAKE-1A — Production batch intake validation probe.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ge-aios-multi-lead-intake-1a.ts
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import {
  findActiveAutonomousProspectSearchDatamoonRun,
  findLatestAutonomousProspectSearchDatamoonRun,
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  assembleMultiLeadIntakeValidationReport,
  captureMultiLeadIntakePreflightState,
  GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER,
} from "@/lib/growth/training/multi-lead-intake-production-validation-1a"

const MAX_TICKS = Number(process.env.GE_AIOS_MULTI_LEAD_INTAKE_1A_MAX_TICKS ?? "6")
const TICK_INTERVAL_MS = Number(process.env.GE_AIOS_MULTI_LEAD_INTAKE_1A_TICK_INTERVAL_MS ?? "120000")
const ANALYZE_RUN_ID = process.argv[2] ?? process.env.GE_AIOS_MULTI_LEAD_INTAKE_1A_RUN_ID ?? null
const READONLY = process.env.GE_AIOS_MULTI_LEAD_INTAKE_1A_READONLY === "1"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function countLeadsSince(
  admin: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
  sinceIso: string,
) {
  const { count } = await admin
    .schema("growth")
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", sinceIso)
  return count ?? 0
}

async function resolveFocusRunId(
  admin: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
  validationStartedAt: string,
) {
  if (ANALYZE_RUN_ID) return ANALYZE_RUN_ID

  const active = await findActiveAutonomousProspectSearchDatamoonRun(admin, orgId)
  if (active) return active.id

  const latest = await findLatestAutonomousProspectSearchDatamoonRun(admin, orgId)
  if (latest && latest.createdAt >= validationStartedAt) return latest.id

  const { data } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, created_at, provider_metadata")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .gte("created_at", validationStartedAt)
    .order("created_at", { ascending: false })
    .limit(1)

  return data?.[0]?.id ?? latest?.id ?? null
}

async function isRunIntakeComplete(
  admin: import("@supabase/supabase-js").SupabaseClient,
  runId: string | null,
) {
  if (!runId) return false
  const { fetchDatamoonAudienceImportRunById } = await import(
    "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
  )
  const run = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!run) return false
  const intake = readAutonomousRunIntakeLifecycleFields(run)
  return intake.intake_completed === true || (intake.intake_pushed_count ?? 0) > 0
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const validationStartedAt = new Date().toISOString()
  const idempotencyKey = `ge-aios-multi-lead-intake-1a-${validationStartedAt.slice(0, 10)}-${validationStartedAt.slice(11, 19).replace(/:/g, "")}`

  const preflight = await captureMultiLeadIntakePreflightState(admin, {
    organizationId: orgId,
    idempotencyKey,
  })

  console.log(
    JSON.stringify(
      {
        phase: "preflight",
        qaMarker: GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER,
        idempotencyKey,
        preflight,
      },
      null,
      2,
    ),
  )

  let tickCount = 0
  let lastSchedulerTelemetry: unknown = null
  let idempotentRerun = {
    ran: false,
    newLeadsCreated: 0,
    duplicateLeadsCreated: 0,
    pass: true,
  }

  if (!READONLY && !ANALYZE_RUN_ID) {
    for (let attempt = 0; attempt < MAX_TICKS; attempt += 1) {
      tickCount += 1
      const tickStartedAt = Date.now()
      const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)
      lastSchedulerTelemetry = schedulerResult.telemetry

      const focusRunId = await resolveFocusRunId(admin, orgId, validationStartedAt)
      const leadsAfterTick = await countLeadsSince(admin, orgId, validationStartedAt)
      const intakeComplete = await isRunIntakeComplete(admin, focusRunId)

      console.log(
        JSON.stringify(
          {
            phase: "controlled_tick",
            tick: tickCount,
            tickDurationMs: Date.now() - tickStartedAt,
            focusRunId,
            leadsCreatedInWindow: leadsAfterTick,
            intakeComplete,
            schedulerTelemetry: schedulerResult.telemetry,
          },
          null,
          2,
        ),
      )

      if (intakeComplete && leadsAfterTick >= 3) break
      if (attempt < MAX_TICKS - 1) await sleep(TICK_INTERVAL_MS)
    }

    // Idempotent rerun — one additional tick must not create duplicate leads.
    const leadsBeforeRerun = await countLeadsSince(admin, orgId, validationStartedAt)
    await runGrowthObjectiveRuntimeScheduler(admin)
    const leadsAfterRerun = await countLeadsSince(admin, orgId, validationStartedAt)
    idempotentRerun = {
      ran: true,
      newLeadsCreated: Math.max(0, leadsAfterRerun - leadsBeforeRerun),
      duplicateLeadsCreated: 0,
      pass: leadsAfterRerun === leadsBeforeRerun,
    }
  }

  const validationCompletedAt = new Date().toISOString()
  const focusRunId = await resolveFocusRunId(admin, orgId, validationStartedAt)

  const outboundInWindow = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", validationStartedAt)

  const report = await assembleMultiLeadIntakeValidationReport(admin, {
    organizationId: orgId,
    idempotencyKey,
    validationStartedAt,
    validationCompletedAt,
    focusRunId,
    preflight,
    idempotentRerun,
    outboundMessagesInWindow: outboundInWindow.count ?? 0,
  })

  console.log("\n--- PER-COMPANY RECONCILIATION ---")
  for (const row of report.perCompany.slice(0, 25)) {
    console.log(
      `  ${row.companyName ?? "?"} | ${row.domain ?? "?"} | push=${row.pushOutcome ?? "-"} | admission=${row.admissionOutcome} | lead=${row.leadId ?? "-"} | research=${row.researchStatus}`,
    )
    if (row.failureReason) console.log(`    reason: ${row.failureReason}`)
  }

  console.log("\n--- BATCH ACCOUNTING ---")
  console.log(JSON.stringify(report.batchAccounting, null, 2))

  console.log("\n--- SCALE VERDICTS ---")
  for (const scale of report.scaleVerdicts) {
    console.log(`  ${scale.target}: ${scale.verdict} — ${scale.basis}`)
    for (const factor of scale.limitingFactors) console.log(`    - ${factor}`)
  }

  console.log("\n--- CERTIFICATION ---")
  console.log(
    JSON.stringify(
      {
        qaMarker: report.qaMarker,
        executiveVerdict: report.executiveVerdict,
        verdictReasons: report.verdictReasons,
        counts: report.counts,
        focusRunId: report.focusRunId,
        focusAudienceId: report.focusAudienceId,
        idempotencyKey: report.idempotencyKey,
        idempotentRerun: report.idempotentRerun,
        outboundConfirmedDisabled: report.outboundConfirmedDisabled,
        outboundMessagesInWindow: report.outboundMessagesInWindow,
        ticksExecuted: tickCount,
        lastSchedulerTelemetry,
        recommendedNextAction: report.recommendedNextAction,
      },
      null,
      2,
    ),
  )

  console.log(`\nVERDICT: ${report.executiveVerdict}\n`)

  if (!ANALYZE_RUN_ID && report.counts.providerCandidates === 0) {
    console.log(
      JSON.stringify(
        {
          phase: "live_tick_note",
          message:
            "Live scheduler tick produced no new batch — likely blocked by admission queue or portfolio health gates. Re-run with run ID for historical batch evidence, e.g. 7a8a9e74-a753-4f01-a4b8-753b6079e9b8",
          preflightReplenishmentReason: preflight.portfolio.replenishmentReason,
        },
        null,
        2,
      ),
    )
  }

  console.log(JSON.stringify(report, null, 2))

  process.exit(report.executiveVerdict === "FAIL" ? 1 : 0)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
