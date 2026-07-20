/**
 * GE-AIOS-FIRST-CUSTOMER-PIPELINE-SCALING-1C — Production pipeline funnel probe.
 * Run: pnpm probe:ge-aios-first-customer-pipeline-scaling-1c
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runPipelineScalingProductionAudit } from "@/lib/growth/training/pipeline-scaling-production-audit-1c"
import { GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER } from "@/lib/growth/training/pipeline-scaling-funnel-metrics-1c"
export { GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER }

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const report = await runPipelineScalingProductionAudit({
    admin: bootstrap.admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  })

  console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER}] Pipeline scaling audit`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}\n`)

  console.log("Phase 1 — Funnel (stage → count → conv → cumulative)")
  for (const stage of report.funnelStages) {
    const conv =
      stage.conversionFromPrevious != null
        ? `${(stage.conversionFromPrevious * 100).toFixed(1)}%`
        : "—"
    const cum =
      stage.cumulativeFromProvider != null
        ? `${(stage.cumulativeFromProvider * 100).toFixed(2)}%`
        : "—"
    console.log(`  ${stage.label}: ${stage.count} | step ${conv} | cumulative ${cum}`)
  }

  if (report.largestDropOff) {
    console.log(
      `\nLargest drop-off: ${report.largestDropOff.label} (${(report.largestDropOff.dropOffPct * 100).toFixed(1)}% lost — ${report.largestDropOff.fromCount} → ${report.largestDropOff.toCount})`,
    )
  }

  console.log("\nAuxiliary rejection counts")
  console.log(`  Geography rejections: ${report.funnelCounts.geography_rejection ?? 0}`)
  console.log(`  Industry rejections: ${report.funnelCounts.industry_rejection ?? 0}`)
  console.log(`  Provider bridge gap (recoverable): ${report.funnelCounts.provider_bridge_gap ?? 0}`)
  console.log(`  Keyword rejections (pre-intake): ${report.funnelCounts.keyword_rejection ?? 0}`)

  console.log("\nPhase 2 — Rejection evidence (sample)")
  for (const row of report.rejectionEvidence.slice(0, 8)) {
    console.log(
      `  • ${row.company} | ${row.reason} | correct=${row.rejectionCorrect} | bridge=${row.bridgeMappingAvailable}`,
    )
  }

  console.log("\nPhase 3 — Throughput opportunities")
  for (const opp of report.throughputOpportunities) {
    console.log(`  [${opp.severity.toUpperCase()}] ${opp.description}`)
    console.log(`    Evidence: ${opp.evidence}`)
    console.log(`    Expected lift: ${opp.expectedLift}`)
  }

  console.log("\nPhase 4 — ICP quality samples")
  for (const sample of report.icpQualitySamples) {
    console.log(
      `  • ${sample.company} | ${sample.classification} | outreach=${sample.outreachEligible} | ${sample.rootCause}`,
    )
  }

  console.log("\nPhase 5 — Capacity projection")
  console.log(`  Current qualified/week: ${report.capacityProjection.currentPerWeek.toFixed(2)}`)
  console.log(`  After improvements/week: ${report.capacityProjection.projectedPerWeek.toFixed(2)}`)
  console.log(`  Basis: ${report.capacityProjection.basis}`)

  console.log("\nPhase 6 — Supervised sales readiness")
  console.log(`  Ready: ${report.supervisedSalesReadiness.ready}`)
  console.log(`  Reason: ${report.supervisedSalesReadiness.reason}`)
  console.log(`  Packages ready: ${report.packagesReady}`)
  console.log(`  Outbound kill switch: ${report.outboundKillSwitchEnabled ? "ON" : "OFF"}`)

  if (report.blockers.length > 0) {
    console.log("\nBlockers")
    for (const blocker of report.blockers) {
      console.log(`  [${blocker.severity.toUpperCase()}] ${blocker.description}`)
    }
  }

  console.log("\n--- JSON ---")
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
