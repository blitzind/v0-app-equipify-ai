/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Production portfolio intake probe.
 * Run: pnpm probe:ge-aios-first-customer-portfolio-intake-1d
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runPortfolioIntakeProductionAudit } from "@/lib/growth/training/portfolio-intake-production-audit-1d"
import { GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER } from "@/lib/growth/training/portfolio-intake-survivor-types-1d"

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const report = await runPortfolioIntakeProductionAudit({
    admin: bootstrap.admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  })

  console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER}] Portfolio intake audit`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}\n`)

  console.log("Phase 1 — Survivor inventory")
  console.log(`  Cumulative instances: ${report.survivorStats.cumulativeInstances}`)
  console.log(`  Unique canonical: ${report.survivorStats.uniqueCanonical}`)
  console.log(`  Completed runs: ${report.survivorStats.completedRuns}`)
  console.log(`  Promoted instances: ${report.survivorStats.promotedInstances}`)
  console.log(`  Non-promoted: ${report.survivorStats.nonPromotedInstances}`)

  console.log("\nPhase 2 — Classification table")
  for (const row of report.classificationSummary) {
    console.log(`  ${row.classification}: ${row.count}`)
  }
  console.log(`  Total non-promoted classified: ${report.classificationCheck.nonPromotedTotal}`)
  console.log(`  Unclassified: ${report.classificationCheck.unclassified}`)

  console.log("\nPhase 4 — Correct vs incorrect")
  console.log(`  Correctly not promoted: ${report.correctlyNotPromoted}`)
  console.log(`  Incorrectly not promoted: ${report.incorrectlyNotPromoted}`)

  console.log("\nPhase 5 — Bottleneck quantification")
  const nonPromotedSummary = report.classificationSummary.filter(
    (row) => row.classification !== "promoted_to_lead",
  )
  for (const row of nonPromotedSummary) {
    console.log(`  ${row.classification}: ${row.count}`)
  }

  console.log("\nPhase 3 — Decision trace (incorrect samples)")
  for (const row of report.incorrectlyNotPromotedSamples) {
    console.log(`  • ${row.company} | ${row.classification}`)
    console.log(`    ${row.decisionTrace.function} (${row.decisionTrace.file})`)
    console.log(`    ${row.decisionTrace.stoppingReason}`)
  }

  console.log("\nRoot causes")
  for (const cause of report.rootCauses) {
    console.log(`  [${cause.severity.toUpperCase()}] ${cause.description}`)
    console.log(`    Evidence: ${cause.productionEvidence}`)
    console.log(`    Smallest fix: ${cause.smallestFix}`)
  }

  console.log("\nExisting org leads outside survivor inventory")
  for (const lead of report.existingLeadsOutsideSurvivorInventory) {
    console.log(`  • ${lead.company} (${lead.leadId}) — ${lead.note}`)
  }

  console.log("\nPhase 6 — Throughput projection (incorrect fixes only)")
  console.log(`  Survivors: ${report.throughputProjection.prospectSearchSurvivors}`)
  console.log(`  Leads: ${report.throughputProjection.leadsCreated}`)
  console.log(`  Research: ${report.throughputProjection.researchInitiated}`)
  console.log(`  Packages: ${report.throughputProjection.approvalPackages}`)
  console.log(`  Outreach-ready: ${report.throughputProjection.outreachReady}`)
  console.log(`  Basis: ${report.throughputProjection.basis}`)

  console.log("\nPhase 7 — Architecture audit")
  console.log(`  ICP weakened: ${report.architectureAudit.icpWeakened}`)
  console.log(`  ${report.architectureAudit.note}`)

  console.log(`\nRecommended next: ${report.recommendedNextMilestone}`)
  console.log("\n--- JSON ---")
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
