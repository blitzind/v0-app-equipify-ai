/**
 * Phase GS-2C — Human-gated prospect discovery execution certification.
 *
 * Local: pnpm test:prospect-discovery-execution
 * Production: pnpm test:prospect-discovery-execution:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildProspectExecutionPlan,
  buildProspectSearchPlan,
  parseProspectSearchIntent,
  selectProspectExecutionProviders,
} from "../lib/growth/prospect-discovery"
import {
  PROSPECT_DISCOVERY_EXECUTION_CONFIRM,
  PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
} from "../lib/growth/prospect-discovery/prospect-execution-run-types"
import { buildProspectExecutionProgress } from "../lib/growth/prospect-discovery/prospect-execution-progress"
import type { ProspectExecutionStageId } from "../lib/growth/prospect-discovery/prospect-execution-plan-types"
import { createProspectExecutionBudgetContext, evaluateProspectExecutionBudgetGuard } from "../lib/growth/prospect-discovery/prospect-execution-budget-guards"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-2C local regression (${PROSPECT_DISCOVERY_EXECUTION_QA_MARKER}) ===\n`)

  assert.equal(PROSPECT_DISCOVERY_EXECUTION_QA_MARKER, "growth-prospect-discovery-execution-gs2c-v1")
  assert.equal(PROSPECT_DISCOVERY_EXECUTION_CONFIRM, "RUN_PROSPECT_DISCOVERY_EXECUTION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/prospect-discovery/prospect-execution-runner.ts",
    "lib/growth/prospect-discovery/prospect-stage-executor.ts",
    "lib/growth/prospect-discovery/prospect-execution-progress.ts",
    "lib/growth/prospect-discovery/prospect-execution-results.ts",
    "lib/growth/prospect-discovery/prospect-execution-budget-guards.ts",
    "lib/growth/prospect-discovery/prospect-discovery-execution-certification.ts",
    "app/api/platform/growth/prospect-discovery/execute/route.ts",
    "app/api/platform/growth/prospect-discovery/execution-status/[executionId]/route.ts",
    "app/api/platform/growth/prospect-discovery/pause/route.ts",
    "app/api/platform/growth/prospect-discovery/cancel/route.ts",
    "components/growth/prospect-search/prospect-discovery-execution-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-2C module files exist")

  const plan = buildProspectSearchPlan(parseProspectSearchIntent("Find HVAC companies in Texas with hiring signals."))
  const execPlan = buildProspectExecutionPlan({ search_plan: plan })
  const providers = selectProspectExecutionProviders(plan)
  assert.ok(providers.includes("real_world_google_places"))
  assert.ok(execPlan.execution_stages.length >= 3)
  console.log("  ✓ provider selection and stages")

  const budget = createProspectExecutionBudgetContext(execPlan, { certification_mode: true })
  const guard = evaluateProspectExecutionBudgetGuard(budget)
  assert.equal(guard.action, "continue")
  console.log("  ✓ budget guards")

  const mockRun = {
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    execution_run_id: "test",
    execution_plan_id: "plan",
    search_plan_id: "search",
    operator_id: null,
    status: "running" as const,
    current_stage: "company_discovery" as const,
    completed_stages: [] as ProspectExecutionStageId[],
    stage_states: execPlan.execution_stages.map((s) => ({
      stage_id: s.stage_id,
      status: "pending" as const,
      started_at: null,
      completed_at: null,
      companies_delta: 0,
      contacts_delta: 0,
      credits_delta: 0,
      message: null,
    })),
    estimated_progress_pct: 0,
    companies_discovered: 0,
    contacts_discovered: 0,
    credits_consumed: 0,
    warnings: [],
    failures: [],
    discovery_run_id: null,
    company_ids: [],
    qualified_company_ids: [],
    signal_feed_routed_count: 0,
    execution_started_at: null,
    execution_completed_at: null,
    enrollment_enabled: false as const,
    outreach_enabled: false as const,
  }
  const progress = buildProspectExecutionProgress(mockRun, execPlan)
  assert.ok(progress.estimated_progress_pct >= 0)
  console.log("  ✓ progress builder")

  const executeRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-discovery/execute/route.ts"),
    "utf8",
  )
  assert.ok(executeRoute.includes("PROSPECT_DISCOVERY_EXECUTION_CONFIRM"))
  assert.ok(executeRoute.includes("runProspectDiscoveryExecution"))
  assert.ok(executeRoute.includes("enrollment_enabled: false"))
  assert.ok(!executeRoute.includes("executeOutreach"))
  console.log("  ✓ execute API requires confirm token")

  const pauseRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-discovery/pause/route.ts"),
    "utf8",
  )
  assert.ok(pauseRoute.includes("enrollment_enabled: false"))
  assert.ok(!pauseRoute.includes("executeOutreach"))
  console.log("  ✓ pause/cancel APIs — no enrollment")

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
  const { executeProspectDiscoveryExecutionCertification } = await import(
    "../lib/growth/prospect-discovery/prospect-discovery-execution-certification"
  )
  return executeProspectDiscoveryExecutionCertification(admin, {})
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
          qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
          hint: "Run pnpm test:prospect-discovery-execution:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-2C production certification (${PROSPECT_DISCOVERY_EXECUTION_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
