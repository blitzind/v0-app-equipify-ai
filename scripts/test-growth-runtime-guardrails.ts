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

  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN, 100)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_DIFF_MEMBERS, 10_000)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_PREVIEW_MEMBERS, 10_000)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN, 100)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_BOOKINGS_PER_DAY, 500)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_MEDIA_ASSETS_PER_ORG, 5_000)

  const guardrailConfig = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
  assert.match(guardrailConfig, /audience_diffs/)
  assert.match(guardrailConfig, /media_assets/)
  assert.match(guardrailConfig, /landing_pages/)
  assert.match(guardrailConfig, /video_events/)
  assert.match(guardrailConfig, /media_assets_enabled/)
  assert.match(guardrailConfig, /booking_tracking_enabled/)
  assert.match(guardrailConfig, /audience_lead_creations/)
  assert.match(guardrailConfig, /audience_enrollment_previews/)
  assert.match(guardrailConfig, /audience_enrollments/)
  assert.match(guardrailConfig, /audience_diff_enabled/)
  assert.match(guardrailConfig, /audience_lead_creation_enabled/)
  assert.match(guardrailConfig, /audience_preview_enabled/)
  assert.match(guardrailConfig, /audience_enrollment_enabled/)
  assert.match(guardrailConfig, /sendr_page_links/)
  assert.match(guardrailConfig, /sendr_url_resolutions/)
  assert.match(guardrailConfig, /sendr_timeline_events/)
  assert.match(guardrailConfig, /sendr_sequence_bridge_enabled/)
  assert.match(guardrailConfig, /sendr_timeline_enabled/)

  const sendrGuardrails = readSource("lib/growth/sendr/growth-sendr-guardrails.ts")
  assert.match(sendrGuardrails, /sendr_page_links/)
  assert.match(sendrGuardrails, /sendr_intelligence/)
  assert.match(guardrailConfig, /sendr_intelligence/)
  assert.match(guardrailConfig, /sendr_recommendations/)
  assert.match(guardrailConfig, /sendr_timeline_updates/)
  assert.match(guardrailConfig, /sendr_intelligence_enabled/)
  assert.match(guardrailConfig, /sendr_recommendations_enabled/)
  assert.match(guardrailConfig, /sendr_launches/)
  assert.match(guardrailConfig, /sendr_launch_previews/)
  assert.match(guardrailConfig, /sendr_launch_enabled/)
  assert.match(guardrailConfig, /sendr_launch_preview_enabled/)
  assert.match(guardrailConfig, /sendr_analytics/)
  assert.match(guardrailConfig, /sendr_dashboard_refreshes/)
  assert.match(guardrailConfig, /sendr_analytics_enabled/)
  assert.match(guardrailConfig, /sendr_activity/)
  assert.match(guardrailConfig, /sendr_activity_refreshes/)
  assert.match(guardrailConfig, /sendr_activity_enabled/)

  assert.match(sendrGuardrails, /sendr_launches/)
  assert.match(sendrGuardrails, /sendr_launch_previews/)
  assert.match(sendrGuardrails, /sendr_analytics/)
  assert.match(sendrGuardrails, /sendr_dashboard_refreshes/)
  assert.match(sendrGuardrails, /sendr_activity/)
  assert.match(sendrGuardrails, /sendr_activity_refreshes/)

  const launchConfig = readSource("lib/growth/sendr/growth-sendr-config.ts")
  assert.match(launchConfig, /MAX_SENDR_LAUNCH_PREVIEW_CHUNK/)
  assert.match(launchConfig, /MAX_SENDR_LAUNCH_ENROLLMENT_CHUNK/)
  assert.match(launchConfig, /MAX_SENDR_LAUNCH_STEP_DURATION_MS/)
  assert.match(launchConfig, /MAX_SENDR_ANALYTICS_ROWS/)
  assert.match(launchConfig, /GROWTH_SENDR_ANALYTICS_QA_MARKER/)
  assert.match(launchConfig, /GROWTH_SENDR_ACTIVITY_QA_MARKER/)
  assert.match(launchConfig, /MAX_SENDR_ACTIVITY_FEED/)

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
