/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Production supervised sales probe (read-only + preview packages).
 * Run: pnpm probe:ge-aios-first-customer-supervised-sales-1b
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runSupervisedSalesProductionEvaluation } from "@/lib/growth/training/supervised-sales-production-orchestrator-1b"
import { GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER } from "@/lib/growth/training/supervised-sales-workflow-1b-types"

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const admin = bootstrap.admin

  console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER}] Supervised sales production probe`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}\n`)

  const report = await runSupervisedSalesProductionEvaluation({
    admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    packageLimit: 3,
  })

  console.log("Phase 1 — Runtime readiness")
  for (const row of report.runtimeAudit) {
    console.log(`  [${row.status.toUpperCase()}] ${row.label}`)
  }
  console.log(
    `\nOutbound kill switch (autonomy_outbound_enabled): ${report.outboundKillSwitchEnabled ? "ON — BLOCKER" : "OFF ✓"}`,
  )

  if (report.admissionPoolSummary) {
    console.log("\nAdmission pool")
    console.log(`  Active leads: ${report.admissionPoolSummary.totalActiveLeads}`)
    console.log(`  Outreach eligible: ${report.admissionPoolSummary.outreachEligible}`)
    console.log(`  Accepted: ${report.admissionPoolSummary.accepted} | Review: ${report.admissionPoolSummary.review}`)
  }

  console.log("\nPhase 2 — Selected production prospects")
  if (report.selectedLeads.length === 0) {
    console.log("  No outreach-eligible researched leads found.")
  }
  for (const lead of report.selectedLeads) {
    console.log(
      `  • ${lead.companyName ?? lead.leadId} | score ${(lead.qualityScore * 100).toFixed(0)}% | admission ${lead.admissionState} | package ${lead.existingPackageId ?? "preview"}`,
    )
  }

  console.log("\nPhase 3 — Approval packages")
  for (const pkg of report.packages) {
    console.log(`\n--- ${pkg.companyName ?? pkg.leadId} (${pkg.source}) ---`)
    console.log(`Package ID: ${pkg.packageId ?? "preview"}`)
    console.log(`Executive summary: ${pkg.operatorPackage.executiveSummary.slice(0, 200)}…`)
    console.log(`Why buy: ${pkg.operatorPackage.whyBuy.slice(0, 160)}…`)
    console.log(`Pain points: ${pkg.operatorPackage.painPoints.slice(0, 3).join(" | ")}`)
    console.log(`Recommended package: ${pkg.operatorPackage.recommendedPackage}`)
    console.log("\nApproval summary (one-screen):")
    for (const line of pkg.operatorPackage.approvalSummary) {
      console.log(`  • ${line}`)
    }
    console.log("\nOutreach channels:")
    console.log(`  Email: ${pkg.operatorPackage.outreach.email ? "ready" : "missing"}`)
    console.log(`  LinkedIn: ${pkg.operatorPackage.outreach.linkedIn ? "ready" : "missing"}`)
    console.log(`  Phone: ${pkg.operatorPackage.outreach.phoneOpening ? "ready" : "missing"}`)
    console.log(`  Voicemail: ${pkg.operatorPackage.outreach.voicemail ? "ready" : "missing"}`)
    console.log(`  Follow-up: ${pkg.operatorPackage.outreach.followUp ? "ready" : "missing"}`)
  }

  console.log("\nPhase 6 — Workflow scores")
  for (const row of report.workflowScores) {
    console.log(`  ${row.dimension}: ${(row.score * 100).toFixed(0)}% — ${row.notes}`)
  }
  console.log(`\nOverall readiness: ${(report.overallReadinessScore * 100).toFixed(0)}%`)
  console.log(`Supervised cycle ready: ${report.supervisedCycleReady}`)

  if (report.blockers.length > 0) {
    console.log("\nBlockers")
    for (const blocker of report.blockers) {
      console.log(`  [${blocker.severity.toUpperCase()}] ${blocker.description}`)
    }
  }

  const outboundCount = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })

  console.log(`\nOutbound messages in DB (unchanged expected): ${outboundCount.count ?? 0}`)
  console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER}`)

  if (!report.supervisedCycleReady) {
    process.exit(2)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
