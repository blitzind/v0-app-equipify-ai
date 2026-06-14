/**
 * Phase GS-2B — Prospect Execution Planner certification.
 *
 * Local: pnpm test:prospect-execution-planner
 * Production: pnpm test:prospect-execution-planner:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  PROSPECT_EXECUTION_EXECUTE_CONFIRM,
  PROSPECT_EXECUTION_QA_MARKER,
  buildProspectExecutionPlan,
  buildProspectExecutionReadiness,
  buildProspectSearchPlan,
  parseProspectSearchIntent,
  resolveProspectProviderEnvSnapshot,
  selectProspectExecutionProviders,
} from "../lib/growth/prospect-discovery"
import { buildProspectExecutionReadinessPayload } from "../lib/growth/prospect-discovery/prospect-execution-certification"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-2B local regression (${PROSPECT_EXECUTION_QA_MARKER}) ===\n`)

  assert.equal(PROSPECT_EXECUTION_QA_MARKER, "growth-prospect-execution-gs2b-v1")
  console.log("  ✓ QA marker")

  const requiredFiles = [
    "lib/growth/prospect-discovery/prospect-execution-plan-types.ts",
    "lib/growth/prospect-discovery/prospect-execution-plan-builder.ts",
    "lib/growth/prospect-discovery/prospect-provider-selection.ts",
    "lib/growth/prospect-discovery/prospect-cost-estimator.ts",
    "lib/growth/prospect-discovery/prospect-execution-readiness.ts",
    "lib/growth/prospect-discovery/prospect-execution-certification.ts",
    "app/api/platform/growth/prospect-discovery/execution-plan/route.ts",
    "app/api/platform/growth/prospect-discovery/execution-readiness/route.ts",
    "app/api/platform/growth/prospect-discovery/approve-plan/route.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-2B module files exist")

  const biomedical = buildProspectSearchPlan(
    parseProspectSearchIntent(
      "Find independent biomedical service companies in the southeast with 10-100 employees servicing hospitals.",
    ),
  )
  const providers = selectProspectExecutionProviders(biomedical)
  assert.ok(providers.includes("real_world_google_places"))
  assert.ok(providers.includes("apollo_people_search"))
  console.log("  ✓ provider selection")

  const executionPlan = buildProspectExecutionPlan({ search_plan: biomedical })
  assert.ok(executionPlan.execution_stages.some((s) => s.stage_id === "company_discovery"))
  assert.ok(executionPlan.execution_stages.some((s) => s.stage_id === "qualification"))
  assert.ok(executionPlan.estimated_companies >= 10)
  assert.ok(executionPlan.estimated_contacts >= executionPlan.estimated_companies)
  console.log("  ✓ execution stages and volume estimation")

  assert.ok(executionPlan.estimated_credits >= 0)
  assert.ok(executionPlan.cost_breakdown.total_provider_units > 0)
  assert.ok(["low", "medium", "high", "expensive"].includes(executionPlan.budget_guardrail))
  console.log("  ✓ cost estimation and budget guardrail")

  const readiness = buildProspectExecutionReadiness({
    search_plan: biomedical,
    env: resolveProspectProviderEnvSnapshot(process.env as Record<string, string | undefined>),
  })
  assert.ok(["ready", "partially_ready", "blocked"].includes(readiness.status))
  console.log("  ✓ readiness evaluation")

  assert.ok(executionPlan.warnings.length >= 2)
  assert.ok(executionPlan.risks.length >= 1)
  console.log("  ✓ warning generation")

  const readinessPayload = buildProspectExecutionReadinessPayload()
  assert.equal(readinessPayload.execute_confirm, PROSPECT_EXECUTION_EXECUTE_CONFIRM)
  assert.equal(readinessPayload.execution_enabled, false)
  console.log("  ✓ readiness payload — no execution")

  const execRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-discovery/execution-plan/route.ts"),
    "utf8",
  )
  assert.ok(!execRoute.includes("runProspectSearch"))
  assert.ok(!execRoute.includes("runRealWorldCompanyDiscovery"))
  assert.ok(execRoute.includes("execution_enabled: false"))

  const approveRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-discovery/approve-plan/route.ts"),
    "utf8",
  )
  assert.ok(approveRoute.includes("persistProspectExecutionPlanApproval"))
  assert.ok(approveRoute.includes("execution_enabled: false"))
  assert.ok(approveRoute.includes("enrollment_enabled: false"))
  assert.ok(!approveRoute.includes("executeOutreach"))
  assert.ok(!approveRoute.includes("runProspectSearch"))
  console.log("  ✓ APIs are planning/approval-only")

  console.log("\n  Local regression: PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  process.env.VERCEL_ENV = process.env.VERCEL_ENV ?? "production"

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
  const { executeProspectExecutionPlannerCertification } = await import(
    "../lib/growth/prospect-discovery/prospect-execution-certification"
  )
  return executeProspectExecutionPlannerCertification(admin, {})
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")
  runLocalRegression()

  if (!productionOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: PROSPECT_EXECUTION_QA_MARKER,
          hint: "Run pnpm test:prospect-execution-planner:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-2B production certification (${PROSPECT_EXECUTION_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
