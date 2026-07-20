/**
 * GE-AIOS-PORTFOLIO-INTAKE-ORPHAN-ROOT-CAUSE-1E — Production orphan trace probe (read-only).
 * Run: pnpm probe:ge-aios-portfolio-intake-orphan-root-cause-1e
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runPortfolioIntakeOrphanRootCauseAudit } from "@/lib/growth/training/portfolio-intake-orphan-root-cause-evidence-1e"
import {
  GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER,
  PORTFOLIO_INTAKE_ARCHITECTURAL_INTENT_VERDICT,
  PORTFOLIO_INTAKE_INTENDED_CALL_CHAIN,
  PORTFOLIO_INTAKE_MISSING_TRANSITION,
  PORTFOLIO_INTAKE_PROMOTION_OWNER,
  PORTFOLIO_INTAKE_RECOMMENDED_FIX,
} from "@/lib/growth/training/portfolio-intake-orphan-root-cause-1e"

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const report = await runPortfolioIntakeOrphanRootCauseAudit({
    admin: bootstrap.admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  })

  console.log(`[${GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER}] Orphan root cause audit`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}\n`)

  console.log("Phase 1 — Intended architecture")
  console.log(`  Promotion owner: ${PORTFOLIO_INTAKE_PROMOTION_OWNER.component}`)
  console.log(`  Push function: ${PORTFOLIO_INTAKE_PROMOTION_OWNER.pushFunction}`)
  console.log(`  Trigger: scheduler tick → resume_active poll → jobActive false → push`)
  console.log(`  Intent verdict: ${PORTFOLIO_INTAKE_ARCHITECTURAL_INTENT_VERDICT.answer} — ${PORTFOLIO_INTAKE_ARCHITECTURAL_INTENT_VERDICT.label}`)

  console.log("\nPhase 2 — Runtime trace (Halliburton Company orphan)")
  const { survivor, run, lifecycleAtAuditTime, promotionPathBlocked } = report.trace
  console.log(`  Company: ${survivor.company.company_name}`)
  console.log(`  Run: ${run.id} | status=${run.status} | audience=${run.audienceId}`)
  console.log(`  Discovery: ${run.createdAt} → completed ${run.completedAt}`)
  console.log(`  Survivor rank: ${survivor.runRank}/${survivor.runSurvivorCount} | batchSize=${run.batchSize}`)
  console.log(`  intake_completed flag present: ${run.intakeCompletedFlagPresent}`)
  console.log(`  findActive at audit: ${lifecycleAtAuditTime.findActiveReturnsRun} (${lifecycleAtAuditTime.findActiveStatus})`)
  console.log(`  findLatest at audit: ${lifecycleAtAuditTime.findLatestStatus} (${lifecycleAtAuditTime.findLatestId})`)
  console.log(`  Blocking: ${promotionPathBlocked.blockingReason}`)

  console.log("\nCall chain (intended)")
  for (const step of PORTFOLIO_INTAKE_INTENDED_CALL_CHAIN) {
    console.log(`  ${step.order}. ${step.function} — ${step.file}`)
  }

  console.log("\nPhase 3 — Missing transition")
  console.log(`  ${PORTFOLIO_INTAKE_MISSING_TRANSITION.description}`)
  console.log(`  Divergence: ${PORTFOLIO_INTAKE_MISSING_TRANSITION.firstDivergence.function}`)
  console.log(`  Actual: ${PORTFOLIO_INTAKE_MISSING_TRANSITION.firstDivergence.actualPath}`)

  console.log("\nScheduler timing")
  console.log(`  ${report.schedulerTimingEvidence.note}`)

  console.log("\nProduction summary")
  console.log(`  Survivor instances: ${report.productionSummary.cumulativeSurvivorInstances}`)
  console.log(`  Unique canonical: ${report.productionSummary.uniqueCanonicalSurvivors}`)
  console.log(`  Completed runs (zero promotion evidence): ${report.productionSummary.runsWithZeroPromotionEvidence}`)

  console.log("\nPhase 6 — Recommended fix (not implemented)")
  console.log(`  ${PORTFOLIO_INTAKE_RECOMMENDED_FIX.summary}`)
  console.log(`  NOT simply: ${PORTFOLIO_INTAKE_RECOMMENDED_FIX.notSimply}`)
  console.log(`  Next milestone: ${PORTFOLIO_INTAKE_RECOMMENDED_FIX.recommendedImplementationMilestone}`)

  console.log("\n--- JSON ---")
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nPASS ${GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
