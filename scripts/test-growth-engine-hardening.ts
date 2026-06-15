/**
 * Phase GE-HARDEN-3 — Growth Engine production hardening certification.
 *
 * Local: pnpm test:growth-engine-hardening
 * Production: pnpm test:growth-engine-hardening:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { GROWTH_ENGINE_E2E_CHAIN } from "../lib/growth/e2e/growth-engine-e2e-subsystems"
import { GROWTH_ENGINE_EMPTY_STATE_KINDS } from "../lib/growth/e2e/growth-engine-hardening-empty-states"
import { runGrowthEngineHardeningAudit } from "../lib/growth/e2e/growth-engine-hardening-audit"
import {
  GROWTH_ENGINE_HARDENING_CONFIRM,
  GROWTH_ENGINE_HARDENING_QA_MARKER,
} from "../lib/growth/e2e/growth-engine-hardening-types"
import { validateGrowthEngineKillSwitches } from "../lib/growth/e2e/growth-engine-hardening-kill-switches"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-HARDEN-3 local regression (${GROWTH_ENGINE_HARDENING_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGINE_HARDENING_QA_MARKER, "growth-engine-hardening-harden-3-v1")
  assert.equal(GROWTH_ENGINE_HARDENING_CONFIRM, "RUN_GROWTH_ENGINE_HARDENING_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/e2e/growth-engine-hardening-types.ts",
    "lib/growth/e2e/growth-engine-hardening-empty-states.ts",
    "lib/growth/e2e/growth-engine-hardening-audit.ts",
    "lib/growth/e2e/growth-engine-hardening-kill-switches.ts",
    "lib/growth/e2e/growth-engine-hardening-diagnostics.ts",
    "lib/growth/e2e/growth-engine-hardening-diagnostics-service.ts",
    "lib/growth/e2e/growth-engine-hardening-local-harness.ts",
    "lib/growth/e2e/growth-engine-hardening-certification.ts",
    "components/growth/growth-engine-honest-empty-state.tsx",
    "components/growth/growth-engine-panel-resilience.tsx",
    "scripts/test-growth-engine-hardening.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GE-HARDEN-3 harness files exist")

  assert.ok(GROWTH_ENGINE_EMPTY_STATE_KINDS.length >= 9)
  console.log(`  ✓ ${GROWTH_ENGINE_EMPTY_STATE_KINDS.length} standardized empty state kinds`)

  assert.equal(GROWTH_ENGINE_E2E_CHAIN.length, 12)
  console.log("  ✓ 12-subsystem chain registered")

  const killSwitches = validateGrowthEngineKillSwitches()
  assert.ok(killSwitches.length >= 5)
  console.log(`  ✓ ${killSwitches.length} kill switches registered`)

  const audit = runGrowthEngineHardeningAudit()
  assert.equal(audit.safety_audit.violations.length, 0, JSON.stringify(audit.safety_audit.violations, null, 2))
  console.log(`  ✓ safety gate audit (${audit.safety_audit.routes_scanned} routes, ${audit.safety_audit.panels_scanned} panels)`)

  const failed = audit.subsystem_matrix.filter((s) => !s.pass)
  if (failed.length > 0) {
    console.error("  ✗ subsystem hardening failures:", failed.map((f) => f.subsystem_id).join(", "))
    for (const row of failed) {
      console.error(`    ${row.subsystem_id}:`, row.findings.join(", "))
    }
    assert.fail(`subsystem hardening audit failed: ${failed.length} subsystems`)
  }
  console.log("  ✓ all 12 subsystems pass hardening panel audit")

  console.log("\nGE-HARDEN-3 local regression PASS\n")
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
  const { executeGrowthEngineHardeningCertification } = await import(
    "../lib/growth/e2e/growth-engine-hardening-certification"
  )
  return executeGrowthEngineHardeningCertification(admin, { production: true })
}

async function runLocalHarness(): Promise<Record<string, unknown>> {
  const { runGrowthEngineHardeningLocalHarness } = await import(
    "../lib/growth/e2e/growth-engine-hardening-local-harness"
  )
  return runGrowthEngineHardeningLocalHarness()
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
        qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
        hint: "Run pnpm test:growth-engine-hardening:production for full production certification",
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
