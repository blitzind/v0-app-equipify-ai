/**
 * GE-AIOS-LIVE-1 — Production operations validation (read-only).
 *
 * Run after deploying 21C + 21C-4 + 22 + 23 to Vercel Production:
 *   pnpm validate:ge-aios-live-1-production-operations
 *
 * With code-not-yet-deployed flag (pre-deploy baseline):
 *   pnpm validate:ge-aios-live-1-production-operations -- --pre-deploy
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildLive1DailyAvaReport,
  LIVE_1_REQUIRED_QA_MARKERS,
} from "@/lib/growth/live-operations/ge-aios-live-1-operations-analysis"
import { GE_AIOS_LIVE_1_QA_MARKER } from "@/lib/growth/live-operations/ge-aios-live-1-types"

const PHASE = "GE-AIOS-LIVE-1" as const

function parsePreDeploy(argv: string[]): boolean {
  return argv.includes("--pre-deploy")
}

async function main(): Promise<void> {
  const preDeploy = parsePreDeploy(process.argv)
  console.log(`[${PHASE}] Production Operations Validation (read-only)`)
  console.log(`QA marker: ${GE_AIOS_LIVE_1_QA_MARKER}`)
  console.log(`Mode: ${preDeploy ? "pre-deploy baseline" : "post-deploy gate"}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    console.error("GROWTH_ENGINE_AI_ORG_ID not configured")
    process.exit(1)
  }

  console.log("\n--- Required QA Markers ---")
  console.log(JSON.stringify(LIVE_1_REQUIRED_QA_MARKERS, null, 2))

  const report = await buildLive1DailyAvaReport({
    admin,
    organizationId,
    codeDeployed: !preDeploy,
  })

  console.log("\n--- Deployment Gates ---")
  for (const gate of report.deploymentGates) {
    const prefix = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : gate.status === "blocked" ? "○" : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  console.log("\n--- Pipeline Metrics ---")
  console.log(JSON.stringify(report.metrics, null, 2))

  console.log("\n--- Pipeline Risks ---")
  for (const risk of report.pipelineRisks) {
    console.log(`  ! ${risk}`)
  }

  const blockers = report.deploymentGates.filter((gate) => gate.status === "blocked" || gate.status === "fail")
  const warnings = report.deploymentGates.filter((gate) => gate.status === "warn")

  console.log("\n--- Verdict ---")
  if (preDeploy) {
    console.log(`[${PHASE}] PRE-DEPLOY BASELINE — ${blockers.length} blockers expected until deploy`)
    if (blockers.length > 0) {
      console.log("  Next: deploy 21C/22/23 bundle, then re-run without --pre-deploy")
    }
    process.exit(0)
  }

  if (blockers.length > 0) {
    console.log(`[${PHASE}] NO-GO — ${blockers.length} blocking gate(s), ${warnings.length} warning(s)`)
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.log(`[${PHASE}] CONDITIONAL GO — ${warnings.length} warning(s); proceed with operator oversight`)
    process.exit(0)
  }

  console.log(`[${PHASE}] GO — production operations ready for LIVE-1 daily use`)
  process.exit(0)
}

void main()
