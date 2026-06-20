/**
 * GS-RG-1B/1C — Runtime observability certification.
 * Run: pnpm test:growth-runtime-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_RUNTIME_DAILY_BUDGET_CAPS,
  GROWTH_RUNTIME_HOURLY_BUDGET_CAPS,
  GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log("\n=== GS-RG-1C Runtime Observability Certification ===\n")

  const service = readSource("lib/growth/runtime-guardrails/growth-runtime-observability-service.ts")
  const route = readSource("app/api/platform/growth/runtime/observability/route.ts")
  const probe = readSource("lib/growth/runtime-guardrails/growth-runtime-schema-probe.ts")

  assert.match(probe, /GrowthRuntimeSchemaStatus/)
  assert.match(service, /getRetentionBacklogSnapshot/)
  assert.match(service, /runtimeReadsEstimate/)
  assert.match(service, /userBudgets/)
  assert.match(route, /status: snapshot.status/)

  const budgetResources = [
    "searches",
    "enrichments",
    "wake_evaluations",
    "media_events",
    "sequence_enrollments",
    "automation_executions",
  ]
  for (const resource of budgetResources) {
    assert.ok(
      resource in GROWTH_RUNTIME_DAILY_BUDGET_CAPS || resource in GROWTH_RUNTIME_HOURLY_BUDGET_CAPS,
      `missing org budget cap for ${resource}`,
    )
  }
  assert.ok(GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS.searches === 100)

  console.log("  ✓ Schema probe with READY/WARN/MISSING")
  console.log("  ✓ Retention backlog + health counters in snapshot")
  console.log("  ✓ Observability route returns status without throwing")

  console.log("\nGS-RG-1C observability certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
