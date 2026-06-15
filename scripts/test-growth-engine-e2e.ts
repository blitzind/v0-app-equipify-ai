/**
 * Phase GE-HARDEN-1 — Growth Engine end-to-end production certification.
 *
 * Local: pnpm test:growth-engine-e2e
 * Production: pnpm test:growth-engine-e2e:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_ENGINE_E2E_CHAIN,
  GROWTH_ENGINE_E2E_SUBSYSTEMS,
} from "../lib/growth/e2e/growth-engine-e2e-subsystems"
import {
  assertReadinessSafetyInvariants,
  runGrowthEngineSafetyAudit,
} from "../lib/growth/e2e/growth-engine-e2e-safety-audit"
import {
  GROWTH_ENGINE_E2E_CONFIRM,
  GROWTH_ENGINE_E2E_QA_MARKER,
} from "../lib/growth/e2e/growth-engine-e2e-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-HARDEN-1 local regression (${GROWTH_ENGINE_E2E_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGINE_E2E_QA_MARKER, "growth-engine-e2e-harden-1-v1")
  assert.equal(GROWTH_ENGINE_E2E_CONFIRM, "RUN_GROWTH_ENGINE_E2E_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/e2e/growth-engine-e2e-types.ts",
    "lib/growth/e2e/growth-engine-e2e-subsystems.ts",
    "lib/growth/e2e/growth-engine-e2e-safety-audit.ts",
    "lib/growth/e2e/growth-engine-e2e-local-harness.ts",
    "lib/growth/e2e/growth-engine-e2e-production-env.ts",
    "scripts/test-growth-engine-e2e.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GE-HARDEN-1 harness files exist")

  assert.equal(GROWTH_ENGINE_E2E_CHAIN.length, 12)
  assert.equal(GROWTH_ENGINE_E2E_SUBSYSTEMS.length, 12)
  console.log("  ✓ full 12-subsystem workflow chain registered")

  for (const subsystem of GROWTH_ENGINE_E2E_SUBSYSTEMS) {
    const routePath = `app/api/platform/growth${subsystem.readiness_route.replace("/api/platform/growth", "")}/route.ts`
    assert.ok(fs.existsSync(path.join(process.cwd(), routePath)), `Missing: ${routePath}`)
  }
  console.log("  ✓ readiness routes exist for subsystems")

  for (const subsystem of GROWTH_ENGINE_E2E_SUBSYSTEMS) {
    const readiness = subsystem.buildReadiness()
    assert.equal(readiness.qa_marker, subsystem.qa_marker)
    const safety = assertReadinessSafetyInvariants(readiness)
    assert.ok(safety.ok, `${subsystem.subsystem_id}: ${safety.failures.join(", ")}`)
  }
  console.log("  ✓ all readiness payloads pass safety invariants")

  const safetyAudit = runGrowthEngineSafetyAudit()
  assert.equal(safetyAudit.violations.length, 0, JSON.stringify(safetyAudit.violations, null, 2))
  console.log(`  ✓ safety gate audit (${safetyAudit.routes_scanned} routes, ${safetyAudit.panels_scanned} panels)`)

  console.log("\nGE-HARDEN-1 local regression PASS\n")
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
  const { executeGrowthEngineE2ECertification } = await import("../lib/growth/e2e/growth-engine-e2e-certification")
  return executeGrowthEngineE2ECertification(admin, { production: true })
}

async function runLocalHarness(): Promise<Record<string, unknown>> {
  const { runGrowthEngineE2ELocalHarness } = await import("../lib/growth/e2e/growth-engine-e2e-local-harness")
  return runGrowthEngineE2ELocalHarness()
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
        qa_marker: GROWTH_ENGINE_E2E_QA_MARKER,
        hint: "Run pnpm test:growth-engine-e2e:production for full production certification",
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
