/**
 * GS-RG-1 — Runtime guardrails foundation regression checks.
 * Run: pnpm test:growth-runtime-guardrails
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_RUNTIME_GUARDRAIL_LIMITS,
  GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  truncateSearchResults,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import {
  GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION,
  GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION,
} from "../lib/growth/runtime-guardrails/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_RUNTIME_GUARDRAILS_QA_MARKER, "growth-runtime-guardrails-gs-rg-1c-v1")
  assert.ok(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN > 0)
  assert.ok(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_EVENT_SIDE_EFFECTS > 0)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.RAW_EVENT_RETENTION_DAYS, 90)

  const migration = readSource(`supabase/migrations/${GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION}`)
  const migration1c = readSource(`supabase/migrations/${GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.runtime_budgets/)
  assert.match(migration1c, /runtime_user_budgets/)
  assert.match(migration, /growth\.runtime_guardrail_settings/)
  assert.match(migration, /growth\.runtime_wake_batch_state/)
  assert.match(migration, /growth\.growth_event_retention_config/)
  assert.match(migration, /growth\.video_page_rollups/)
  assert.match(migration, /growth\.runtime_cascade_budgets/)
  assert.match(migration, /wake_execution_enabled/)
  assert.match(migration, /service_role/)

  const wakeEngine = readSource("lib/growth/sequences/conditions/sequence-event-wake-engine.ts")
  assert.match(wakeEngine, /isWakeExecutionEnabled/)
  assert.match(wakeEngine, /persistWakeBatchState/)

  const mediaService = readSource("lib/growth/media/media-asset-analytics-service.ts")
  assert.match(mediaService, /incrementMediaAssetEventRollup/)
  assert.doesNotMatch(mediaService, /recomputeMediaAssetEventRollup/)

  const observabilityPage = readSource("app/(growth)/growth/admin/runtime/page.tsx")
  assert.match(observabilityPage, /Runtime Guardrails/)

  const truncated = truncateSearchResults(Array.from({ length: 600 }, (_, i) => i))
  assert.equal(truncated.rows.length, GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_SEARCH_RESULTS)
  assert.equal(truncated.truncated, true)

  console.log("GS-RG-1 runtime guardrails regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
