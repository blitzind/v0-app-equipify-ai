/**
 * Phase GE-OPS-1 — Growth Engine internal dogfooding & Apollo readiness certification.
 *
 * Local: pnpm test:growth-engine-operations
 * Production: pnpm test:growth-engine-operations:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { OPS_DATASET_TIERS } from "../lib/growth/e2e/growth-engine-ops-types"
import { buildApolloReadinessReport } from "../lib/growth/e2e/growth-engine-ops-apollo-audit"
import { runOpsDatasetCertification } from "../lib/growth/e2e/growth-engine-ops-dataset-cert"
import {
  GROWTH_ENGINE_OPS_CONFIRM,
  GROWTH_ENGINE_OPS_QA_MARKER,
} from "../lib/growth/e2e/growth-engine-ops-types"
import {
  certifyHumanWorkflow,
  HUMAN_WORKFLOW_CHAIN,
  verifyWorkflowSafetyInvariants,
} from "../lib/growth/e2e/growth-engine-ops-workflow-audit"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-OPS-1 local regression (${GROWTH_ENGINE_OPS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGINE_OPS_QA_MARKER, "growth-engine-ops-ge-ops-1-v1")
  assert.equal(GROWTH_ENGINE_OPS_CONFIRM, "RUN_GROWTH_ENGINE_OPS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/e2e/growth-engine-ops-types.ts",
    "lib/growth/e2e/growth-engine-ops-thresholds.ts",
    "lib/growth/e2e/growth-engine-ops-apollo-audit.ts",
    "lib/growth/e2e/growth-engine-ops-dataset-cert.ts",
    "lib/growth/e2e/growth-engine-ops-workflow-audit.ts",
    "lib/growth/e2e/growth-engine-ops-operator-audit.ts",
    "lib/growth/e2e/growth-engine-ops-recommendations.ts",
    "lib/growth/e2e/growth-engine-ops-diagnostics-service.ts",
    "lib/growth/e2e/growth-engine-ops-local-harness.ts",
    "lib/growth/e2e/growth-engine-ops-certification.ts",
    "scripts/test-growth-engine-operations.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GE-OPS-1 harness files exist")

  assert.equal(OPS_DATASET_TIERS.length, 3)
  console.log("  ✓ dataset tiers 100/500/1000 registered")

  assert.equal(HUMAN_WORKFLOW_CHAIN.length, 12)
  console.log("  ✓ 12-step human workflow chain registered")

  const apollo = buildApolloReadinessReport()
  assert.equal(apollo.integration_points_verified, apollo.integration_points_total)
  console.log(`  ✓ ${apollo.integration_points_verified} Apollo integration points verified`)

  assert.ok(verifyWorkflowSafetyInvariants())
  console.log("  ✓ human workflow safety invariants")

  const dataset = runOpsDatasetCertification()
  assert.ok(dataset.every((d) => d.pass), JSON.stringify(dataset, null, 2))
  console.log("  ✓ dataset certification tiers pass")

  const workflow = certifyHumanWorkflow()
  assert.ok(workflow.steps.every((s) => s.pass))
  console.log("  ✓ all workflow steps pass readiness safety")

  console.log("\nGE-OPS-1 local regression PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  const { bootstrapGrowthEngineE2EProductionEnv } = await import("../lib/growth/e2e/growth-engine-e2e-production-env")
  bootstrapGrowthEngineE2EProductionEnv()

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthEngineOpsCertification } = await import(
    "../lib/growth/e2e/growth-engine-ops-certification"
  )
  return executeGrowthEngineOpsCertification(admin, { production: true })
}

async function runLocalHarness(): Promise<Record<string, unknown>> {
  const { runGrowthEngineOpsLocalHarness } = await import("../lib/growth/e2e/growth-engine-ops-local-harness")
  return runGrowthEngineOpsLocalHarness()
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")
  runLocalRegression()

  if (productionOnly) {
    const report = await runProductionCertification()
    console.log(JSON.stringify(report, null, 2))
    if (report.final_verdict !== "PASS") {
      process.exitCode = 1
    }
    return
  }

  const localReport = await runLocalHarness()
  console.log(JSON.stringify(localReport, null, 2))

  console.log(
    JSON.stringify(
      {
        ok: localReport.final_verdict === "PASS",
        local_only: true,
        qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
        hint: "Run pnpm test:growth-engine-operations:production for full production certification",
      },
      null,
      2,
    ),
  )

  if (localReport.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
