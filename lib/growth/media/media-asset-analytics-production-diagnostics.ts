import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_MEDIA_ANALYTICS_MIGRATION } from "@/lib/growth/media/media-asset-analytics-types"
import { probeGrowthMediaAssetAnalyticsSchema } from "@/lib/growth/media/media-asset-analytics-schema-health"
import { GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER } from "@/lib/growth/media/media-asset-analytics-service"

export const GROWTH_MEDIA_ANALYTICS_API_ROUTE_PATHS = [
  "app/api/platform/growth/media-assets/events/route.ts",
  "app/api/platform/growth/media-assets/[id]/analytics/route.ts",
  "app/api/platform/growth/media-assets/analytics/summary/route.ts",
] as const

export const GROWTH_MEDIA_ANALYTICS_MODULE_PATHS = [
  "lib/growth/media/media-asset-analytics-types.ts",
  "lib/growth/media/media-asset-analytics-schema-health.ts",
  "lib/growth/media/media-asset-analytics-repository.ts",
  "lib/growth/media/media-asset-analytics-service.ts",
  "lib/growth/media/media-asset-analytics-diagnostics.ts",
  "lib/growth/media/media-asset-analytics-production-diagnostics.ts",
  "hooks/growth/use-growth-media-playback-analytics.ts",
] as const

function probeAnalyticsArtifacts(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []
  const migrationPath = path.join(cwd, "supabase/migrations", GROWTH_MEDIA_ANALYTICS_MIGRATION)
  checks.push({
    name: `migration:${GROWTH_MEDIA_ANALYTICS_MIGRATION}`,
    ok: fs.existsSync(migrationPath),
    error: fs.existsSync(migrationPath) ? null : "missing",
  })

  for (const routePath of GROWTH_MEDIA_ANALYTICS_API_ROUTE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, routePath))
    checks.push({ name: `route:${routePath}`, ok: exists, error: exists ? null : "missing" })
  }

  for (const modulePath of GROWTH_MEDIA_ANALYTICS_MODULE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({ name: `module:${modulePath}`, ok: exists, error: exists ? null : "missing" })
  }

  return checks
}

export async function executeGrowthMediaAssetAnalyticsProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const schemaProbe = await probeGrowthMediaAssetAnalyticsSchema(admin)
  const artifactChecks = probeAnalyticsArtifacts()
  const checks = [
    ...schemaProbe.tables.map((entry) => ({
      name: entry.table,
      ok: entry.ok,
      error: entry.error,
    })),
    ...artifactChecks,
  ]

  const artifactsReady = artifactChecks.every((check) => check.ok)
  const analyticsSchemaReady = schemaProbe.ready
  const failedChecks = checks.filter((check) => !check.ok && !check.name.startsWith("media_asset_"))

  return {
    ok: artifactsReady && failedChecks.length === 0,
    final_verdict: artifactsReady && failedChecks.length === 0 ? "PASS" : "FAIL",
    qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
    analytics_schema_ready: analyticsSchemaReady,
    analytics_migration: GROWTH_MEDIA_ANALYTICS_MIGRATION,
    analytics_migration_applied: analyticsSchemaReady,
    production_read_only: true,
    route_files_verified: artifactChecks.filter((entry) => entry.name.startsWith("route:")).every((entry) => entry.ok),
    module_files_verified: artifactChecks.filter((entry) => entry.name.startsWith("module:")).every((entry) => entry.ok),
    local_only_drift_allowed: !analyticsSchemaReady,
    checks,
  }
}
