/**
 * GS-RG-1C — Final production readiness certification.
 * Run: pnpm test:growth-runtime-production-readiness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_RUNTIME_GUARDRAIL_LIMITS,
  GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS,
  getUserBudgetCapForResource,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import {
  GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION,
  GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION,
} from "../lib/growth/runtime-guardrails/schema-health"
import { estimateRetentionWorkerLoad } from "../lib/growth/runtime-guardrails/growth-event-retention-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-1C Production Readiness Certification ===\n")

  assert.equal(GROWTH_RUNTIME_GUARDRAILS_QA_MARKER, "growth-runtime-guardrails-gs-rg-1c-v1")

  const migration1 = readSource(`supabase/migrations/${GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION}`)
  const migration1c = readSource(`supabase/migrations/${GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION}`)
  assert.match(migration1c, /runtime_user_budgets/)
  assert.match(migration1c, /runtime_health_counters/)
  assert.match(migration1c, /last_duration_ms/)

  const observability = readSource("lib/growth/runtime-guardrails/growth-runtime-observability-service.ts")
  assert.match(observability, /status: GrowthRuntimeSchemaStatus/)
  assert.match(observability, /getRetentionBacklogSnapshot/)
  assert.match(observability, /runtimeReadsEstimate/)
  assert.match(observability, /userBudgets/)

  const route = readSource("app/api/platform/growth/runtime/observability/route.ts")
  assert.match(route, /status: snapshot.status/)
  assert.doesNotMatch(route, /throw new Error/)

  const search = readSource("lib/growth/runtime-guardrails/growth-search-rate-limiter.ts")
  assert.match(search, /consumeUserBudget/)
  assert.match(search, /remainingUserBudget/)
  assert.match(search, /blockedBy/)

  const vercel = readSource("vercel.json")
  assert.match(vercel, /growth-event-retention/)
  assert.match(vercel, /0 4 \* \* \*/)

  assert.equal(getUserBudgetCapForResource("searches", "hourly"), 100)
  assert.ok(GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS.searches === 100)

  const loads = [10_000, 100_000, 1_000_000]
  console.log("  Retention worker estimates (per family, single daily run batch):")
  for (const rows of loads) {
    const est = estimateRetentionWorkerLoad(rows)
    console.log(
      `    ${rows.toLocaleString()} rows → ${est.batchesPerFamilyRun} batches · ~${est.estimatedTotalDurationMs}ms`,
    )
    assert.equal(est.batchesPerFamilyRun, Math.ceil(rows / GROWTH_RUNTIME_GUARDRAIL_LIMITS.RETENTION_DELETE_BATCH))
  }

  const dashboard = readSource("components/growth/growth-runtime-observability-dashboard.tsx")
  assert.match(dashboard, /retentionRowsPending/)
  assert.match(dashboard, /runtimeReadsEstimate/)
  assert.match(dashboard, /userBudgets/)
  assert.doesNotMatch(dashboard, /setInterval/)

  console.log("\n  Checklist:")
  console.log("    ✓ Retention backlog metrics exposed")
  console.log("    ✓ Runtime health counters exposed")
  console.log("    ✓ Missing-table graceful observability")
  console.log("    ✓ Per-user search budgets (org AND user)")
  console.log("    ✓ Retention cron scheduled in vercel.json")
  console.log("\nGS-RG-1C production readiness certification passed.\n")
}

main()
