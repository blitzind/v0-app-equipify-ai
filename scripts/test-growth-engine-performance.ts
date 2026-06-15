/**
 * Phase GE-HARDEN-2 — Growth Engine performance & scale certification.
 *
 * Local: pnpm test:growth-engine-performance
 * Production: pnpm test:growth-engine-performance:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { GROWTH_ENGINE_E2E_CHAIN } from "../lib/growth/e2e/growth-engine-e2e-subsystems"
import { runGrowthEngineSafetyAudit } from "../lib/growth/e2e/growth-engine-e2e-safety-audit"
import {
  GROWTH_ENGINE_PERFORMANCE_CONFIRM,
  GROWTH_ENGINE_PERFORMANCE_QA_MARKER,
} from "../lib/growth/e2e/growth-engine-performance-types"
import { verifyEngineSafetyInvariants } from "../lib/growth/e2e/growth-engine-performance-benchmarks"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-HARDEN-2 local regression (${GROWTH_ENGINE_PERFORMANCE_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGINE_PERFORMANCE_QA_MARKER, "growth-engine-performance-harden-2-v1")
  assert.equal(GROWTH_ENGINE_PERFORMANCE_CONFIRM, "RUN_GROWTH_ENGINE_PERFORMANCE_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/e2e/growth-engine-performance-types.ts",
    "lib/growth/e2e/growth-engine-performance-thresholds.ts",
    "lib/growth/e2e/growth-engine-performance-simulation.ts",
    "lib/growth/e2e/growth-engine-performance-benchmarks.ts",
    "lib/growth/e2e/growth-engine-performance-recommendations.ts",
    "lib/growth/e2e/growth-engine-performance-db-audit.ts",
    "lib/growth/e2e/growth-engine-performance-local-harness.ts",
    "lib/growth/e2e/growth-engine-performance-certification.ts",
    "scripts/test-growth-engine-performance.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GE-HARDEN-2 harness files exist")

  assert.equal(GROWTH_ENGINE_E2E_CHAIN.length, 12)
  console.log("  ✓ 12-subsystem chain registered for performance matrix")

  assert.ok(verifyEngineSafetyInvariants(), "engine safety invariants")
  console.log("  ✓ engine safety invariants (requires_human_review, no execution flags)")

  const safetyAudit = runGrowthEngineSafetyAudit()
  assert.equal(safetyAudit.violations.length, 0, JSON.stringify(safetyAudit.violations, null, 2))
  console.log(`  ✓ safety gate audit (${safetyAudit.routes_scanned} routes, ${safetyAudit.panels_scanned} panels)`)

  console.log("\nGE-HARDEN-2 local regression PASS\n")
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
  const { executeGrowthEnginePerformanceCertification } = await import(
    "../lib/growth/e2e/growth-engine-performance-certification"
  )
  return executeGrowthEnginePerformanceCertification(admin, { production: true })
}

async function runLocalHarness(): Promise<Record<string, unknown>> {
  const { runGrowthEnginePerformanceLocalHarness } = await import(
    "../lib/growth/e2e/growth-engine-performance-local-harness"
  )
  return runGrowthEnginePerformanceLocalHarness()
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
        qa_marker: GROWTH_ENGINE_PERFORMANCE_QA_MARKER,
        hint: "Run pnpm test:growth-engine-performance:production for full production certification",
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
