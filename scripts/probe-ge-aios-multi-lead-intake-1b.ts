/**
 * GE-AIOS-MULTI-LEAD-INTAKE-1B — Admission queue unblock and live cohort progression probe.
 *
 * Diagnose only:
 *   GE_AIOS_MULTI_LEAD_INTAKE_1B_DIAGNOSE_ONLY=1 node ... scripts/probe-ge-aios-multi-lead-intake-1b.ts
 *
 * Full validation (research + scheduler ticks):
 *   CONFIRM_GE_AIOS_MULTI_LEAD_INTAKE_1B_RESEARCH=1 node ... scripts/probe-ge-aios-multi-lead-intake-1b.ts
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  diagnoseAdmissionQueue,
  GROWTH_AIOS_MULTI_LEAD_INTAKE_1B_QA_MARKER,
  runMultiLeadIntakeUnblockValidation,
} from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"

const DIAGNOSE_ONLY = process.env.GE_AIOS_MULTI_LEAD_INTAKE_1B_DIAGNOSE_ONLY === "1"
const RUN_RESEARCH = process.env.CONFIRM_GE_AIOS_MULTI_LEAD_INTAKE_1B_RESEARCH === "1"
const MAX_TICKS = Number(process.env.GE_AIOS_MULTI_LEAD_INTAKE_1B_MAX_TICKS ?? "4")
const TICK_INTERVAL_MS = Number(process.env.GE_AIOS_MULTI_LEAD_INTAKE_1B_TICK_INTERVAL_MS ?? "90000")

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
  const idempotencyKey = `ge-aios-multi-lead-intake-1b-${validationStartedAt.slice(0, 10)}`

  const queueBefore = await diagnoseAdmissionQueue(admin, orgId)
  console.log(
    JSON.stringify(
      {
        phase: "A_queue_diagnosis",
        qaMarker: GROWTH_AIOS_MULTI_LEAD_INTAKE_1B_QA_MARKER,
        queueBefore,
      },
      null,
      2,
    ),
  )

  if (DIAGNOSE_ONLY) {
    console.log(`\nDIAGNOSE ONLY — queue blocked: ${queueBefore.blockedByQueueLimit}`)
    console.log(`Root cause: ${queueBefore.rootCause}`)
    process.exit(0)
  }

  if (!RUN_RESEARCH && queueBefore.blockedByQueueLimit) {
    console.error(
      "Admission queue blocked. Re-run with CONFIRM_GE_AIOS_MULTI_LEAD_INTAKE_1B_RESEARCH=1 to resume research progression.",
    )
  }

  const report = await runMultiLeadIntakeUnblockValidation(admin, {
    organizationId: orgId,
    idempotencyKey,
    validationStartedAt,
    runResearch: RUN_RESEARCH || !queueBefore.blockedByQueueLimit,
    runSchedulerTicks: MAX_TICKS,
    tickIntervalMs: TICK_INTERVAL_MS,
  })

  console.log("\n--- PROGRESSION TABLE ---")
  for (const row of report.progressionTable) {
    console.log(
      `  ${row.company ?? "?"} | admission=${row.admissionResult} | research=${row.researchResult} | qual=${row.qualificationResult} | pkg=${row.operatorPackageResult}`,
    )
    if (row.blocker) console.log(`    blocker: ${row.blocker}`)
  }

  console.log("\n--- QUEUE BEFORE/AFTER ---")
  console.log(
    JSON.stringify(
      {
        before: {
          admissionsPending: report.queueBefore.admissionsPending,
          maximumQueuedAdmissions: report.queueBefore.maximumQueuedAdmissions,
          blocked: report.queueBefore.blockedByQueueLimit,
        },
        after: {
          admissionsPending: report.queueAfter.admissionsPending,
          maximumQueuedAdmissions: report.queueAfter.maximumQueuedAdmissions,
          blocked: report.queueAfter.blockedByQueueLimit,
        },
        unblockingAction: report.unblockingAction,
      },
      null,
      2,
    ),
  )

  console.log("\n--- CERTIFICATION ---")
  console.log(
    JSON.stringify(
      {
        qaMarker: report.qaMarker,
        executiveVerdict: report.executiveVerdict,
        verdictReasons: report.verdictReasons,
        focusRunId: report.focusRunId,
        focusAudienceId: report.focusAudienceId,
        schedulerTicks: report.schedulerTicks,
        outboundConfirmedDisabled: report.outboundConfirmedDisabled,
        outboundMessagesInWindow: report.outboundMessagesInWindow,
        recommendedNextAction: report.recommendedNextAction,
      },
      null,
      2,
    ),
  )

  console.log(`\nVERDICT: ${report.executiveVerdict}\n`)
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.executiveVerdict === "FAIL" ? 1 : 0)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
