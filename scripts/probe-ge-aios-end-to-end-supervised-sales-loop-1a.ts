/**
 * GE-AIOS-END-TO-END-1A — Production read-only supervised sales loop probe.
 * Run: pnpm probe:ge-aios-end-to-end-supervised-sales-loop-1a
 */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV,
  GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-1a-types"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  runEndToEndSupervisedSalesLoopProductionAudit,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-production-audit-1a"

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const liveSendConfirmed = process.env[GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV] === "1"

  console.log(`[${GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER}] End-to-end supervised sales loop probe`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}`)
  console.log(`Live send authorized: ${liveSendConfirmed ? "YES" : "NO (read-only)"}\n`)

  const report = await runEndToEndSupervisedSalesLoopProductionAudit({
    admin: bootstrap.admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    liveSendConfirmed,
  })

  console.log("=== Phase A — Production readiness ===")
  console.log(JSON.stringify(report.phases.productionAudit, null, 2))

  console.log("\n=== Phase B — Prospect selection ===")
  console.log(JSON.stringify(report.phases.prospectSelection, null, 2))

  console.log("\n=== Phase C — Evidence / personalization ===")
  console.log(JSON.stringify(report.phases.evidenceAudit, null, 2))

  console.log("\n=== Phase D — Supervised handoff ===")
  console.log(JSON.stringify(report.phases.handoffAudit, null, 2))

  console.log("\n=== Phase E — Pre-send safety ===")
  console.log(JSON.stringify(report.phases.preSendSafety, null, 2))

  console.log("\n=== Phase H — Chronology ===")
  for (const row of report.chronology) {
    console.log(`  [${row.result.toUpperCase()}] ${row.step} — ${row.record}${row.detail ? ` (${row.detail})` : ""}`)
  }

  if (report.blockers.length > 0) {
    console.log("\nBlockers")
    for (const blocker of report.blockers) {
      console.log(`  [${blocker.severity.toUpperCase()}] ${blocker.message}`)
    }
  }

  console.log(`\nVerdict: ${report.overallVerdict.toUpperCase()}`)
  console.log(`Selected lead: ${report.selectedLeadId}`)
  console.log(`Selected package: ${report.selectedPackageId}`)
  console.log(`Selected enrollment: ${report.selectedEnrollmentId}`)
  console.log(`Selected job: ${report.selectedJobId}`)

  if (!liveSendConfirmed) {
    console.log("\nPhase F/G skipped — set CONFIRM_GE_AIOS_END_TO_END_1A_LIVE_SEND=1 to authorize live send probe.")
  }

  if (report.overallVerdict === "blocked" || report.overallVerdict === "fail") {
    process.exit(2)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
