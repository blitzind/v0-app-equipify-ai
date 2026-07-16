/**
 * GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F — Production replay + certification probe.
 * Run: pnpm probe:ge-aios-portfolio-intake-pending-state-1f
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runPortfolioIntakePendingStateProductionEvidence } from "@/lib/growth/training/portfolio-intake-pending-state-evidence-1f"
import {
  GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER,
  PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN,
  PORTFOLIO_INTAKE_LIFECYCLE_OWNERSHIP,
  PORTFOLIO_INTAKE_REMAINING_BLOCKERS,
  PORTFOLIO_INTAKE_STATE_TRANSITIONS,
} from "@/lib/growth/training/portfolio-intake-pending-state-1f"

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const report = await runPortfolioIntakePendingStateProductionEvidence({
    admin: bootstrap.admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  })

  console.log(`[${GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER}] Intake pending state production evidence`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}\n`)

  console.log("Phase 1 — Lifecycle ownership")
  console.log(`  ${PORTFOLIO_INTAKE_LIFECYCLE_OWNERSHIP.promotionOwner}`)
  console.log(`  Path: ${PORTFOLIO_INTAKE_LIFECYCLE_OWNERSHIP.intakePath}`)

  console.log("\nPhase 2 — State transitions")
  for (const row of PORTFOLIO_INTAKE_STATE_TRANSITIONS) {
    console.log(`  ${row.from} → ${row.to} (${row.trigger})`)
  }

  console.log("\nPhase 3 — Idempotency design")
  for (const [key, value] of Object.entries(PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN)) {
    console.log(`  ${key}: ${value}`)
  }

  console.log("\nPhase 5 — Halliburton replay evidence")
  const replay = report.halliburtonReplay
  console.log(`  Company: ${replay.survivor?.company ?? "n/a"}`)
  console.log(`  Run: ${replay.survivor?.runId ?? "n/a"}`)
  console.log(`  findLatestIntakePending: ${replay.findLatestIntakePendingRunId ?? "null"}`)
  console.log(`  Matches Halliburton run: ${replay.findLatestMatchesHalliburtonRun}`)
  console.log(`  Resume avoids new provider job: ${replay.resumeWouldAvoidNewProviderJob}`)
  console.log(`  Survivor classification: ${replay.intake?.classification ?? "n/a"}`)
  console.log(`  intake_completed: ${replay.intake?.intake?.intake_completed ?? "unset"}`)
  console.log(`  intake_pending: ${replay.intake?.intake?.intake_pending ?? "unset"}`)

  console.log("\nPhase 6 — Portfolio Intake 1D certification (measured)")
  console.log(`  bug classification: ${report.certification.bugClassificationCount}`)
  console.log(`  orphan count: ${report.certification.orphanCount}`)
  console.log(`  waiting_for_scheduler: ${report.certification.waitingForSchedulerCount}`)
  console.log(`  incorrectly not promoted: ${report.certification.incorrectlyNotPromoted}`)
  console.log(`  all classified: ${report.certification.allNonPromotedClassified}`)
  for (const row of report.certification.classificationSummary) {
    console.log(`    ${row.classification}: ${row.count}`)
  }

  console.log("\nPhase 7 — Multi-tenant")
  console.log(`  ${report.multiTenantNote}`)

  console.log("\nRemaining blockers")
  for (const blocker of PORTFOLIO_INTAKE_REMAINING_BLOCKERS) {
    console.log(`  [${blocker.severity}] ${blocker.id}: ${blocker.description}`)
  }

  console.log("\n--- JSON ---")
  console.log(JSON.stringify(report, null, 2))

  const pass =
    report.certification.bugClassificationCount === 0 &&
    report.certification.allNonPromotedClassified &&
    replay.resumeWouldAvoidNewProviderJob

  if (!pass) {
    console.error(`\nFAIL ${GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER}`)
    process.exit(1)
  }

  console.log(`\nPASS ${GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
