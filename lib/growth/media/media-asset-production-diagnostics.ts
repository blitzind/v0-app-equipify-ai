import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthMediaAssetsSchema } from "@/lib/growth/media/media-asset-schema-health"
import {
  GROWTH_MEDIA_ASSETS_MIGRATION,
  GROWTH_MEDIA_ASSETS_QA_MARKER,
} from "@/lib/growth/media/media-asset-types"

export const GROWTH_MEDIA_ASSET_API_ROUTE_PATHS = [
  "app/api/platform/growth/media-assets/route.ts",
  "app/api/platform/growth/media-assets/[id]/route.ts",
  "app/api/platform/growth/media-assets/[id]/attach/route.ts",
  "app/api/platform/growth/media-assets/[id]/detach/route.ts",
  "app/api/platform/growth/media-assets/[id]/upload-session/route.ts",
  "app/api/platform/growth/media-assets/[id]/complete-upload/route.ts",
  "app/api/platform/growth/media-assets/video/route.ts",
  "app/api/platform/growth/media-assets/video/upload-session/route.ts",
  "app/api/platform/growth/media-assets/video/complete-upload/route.ts",
  "app/api/platform/growth/media-assets/video/[id]/route.ts",
  "app/api/platform/growth/media-assets/video/[id]/thumbnail/route.ts",
  "app/api/platform/growth/media-assets/video/generation/route.ts",
  "app/api/platform/growth/media-assets/video/generation/[id]/route.ts",
  "app/api/platform/growth/media-assets/video/generation/[id]/cancel/route.ts",
  "app/api/platform/growth/media-assets/voice/generation/route.ts",
  "app/api/platform/growth/media-assets/voice/generation/[id]/route.ts",
  "app/api/platform/growth/media-assets/voice/generation/[id]/cancel/route.ts",
  "app/api/platform/growth/media-assets/conversation/route.ts",
  "app/api/platform/growth/media-assets/conversation/[id]/route.ts",
  "app/api/platform/growth/media-assets/conversation/[id]/cancel/route.ts",
  "app/api/platform/growth/media-assets/qa/route.ts",
  "app/api/platform/growth/media-assets/qa/[id]/route.ts",
  "app/api/platform/growth/media-assets/qa/[id]/cancel/route.ts",
  "app/api/platform/growth/media-assets/booking-handoff/route.ts",
  "app/api/platform/growth/media-assets/booking-handoff/[id]/route.ts",
  "app/api/platform/growth/media-assets/booking-handoff/[id]/cancel/route.ts",
  "app/api/platform/growth/media-assets/events/route.ts",
  "app/api/platform/growth/media-assets/[id]/analytics/route.ts",
  "app/api/platform/growth/media-assets/analytics/summary/route.ts",
] as const

export const GROWTH_MEDIA_ASSET_MODULE_PATHS = [
  "lib/growth/media/media-asset-types.ts",
  "lib/growth/media/media-asset-analytics-types.ts",
  "lib/growth/media/media-asset-repository.ts",
  "lib/growth/media/media-asset-schema-health.ts",
  "lib/growth/media/media-asset-diagnostics.ts",
  "lib/growth/media/media-asset-production-diagnostics.ts",
  "lib/growth/media/media-asset-cert-bootstrap.ts",
  "lib/growth/media/media-asset-platform-access.ts",
  "lib/growth/media/media-asset-storage-types.ts",
  "lib/growth/media/media-asset-storage-providers.ts",
  "lib/growth/media/media-video-upload-types.ts",
  "lib/growth/media/media-video-upload-utils.ts",
  "lib/growth/media/media-video-upload-service.ts",
  "lib/growth/media/media-video-metadata.ts",
  "lib/growth/media/media-video-upload-route-utils.ts",
  "lib/growth/media/media-webcam-recording-types.ts",
  "lib/growth/media/media-webcam-recording-utils.ts",
  "lib/growth/media/media-video-thumbnail-types.ts",
  "lib/growth/media/media-video-thumbnail-utils.ts",
  "lib/growth/media/media-video-thumbnail-service.ts",
  "lib/growth/media/media-video-thumbnail-route-utils.ts",
  "lib/growth/media/media-asset-analytics-types.ts",
  "lib/growth/media/media-asset-analytics-schema-health.ts",
  "lib/growth/media/media-asset-analytics-repository.ts",
  "lib/growth/media/media-asset-analytics-service.ts",
  "lib/growth/media/media-asset-analytics-diagnostics.ts",
  "lib/growth/media/media-asset-analytics-production-diagnostics.ts",
  "lib/growth/media/media-video-overlay-types.ts",
  "lib/growth/media/media-video-overlay-utils.ts",
  "lib/growth/media/media-avatar-types.ts",
  "lib/growth/media/media-video-generation-types.ts",
  "lib/growth/media/media-video-generation-utils.ts",
  "lib/growth/media/media-video-generation-service.ts",
  "lib/growth/media/media-video-generation-route-utils.ts",
  "lib/growth/media/media-video-generation-diagnostics.ts",
  "lib/growth/media/providers/elevenlabs-video-provider-types.ts",
  "lib/growth/media/providers/elevenlabs-video-provider.ts",
  "lib/growth/media/providers/elevenlabs-video-provider-diagnostics.ts",
  "lib/growth/media/media-voice-types.ts",
  "lib/growth/media/media-voice-generation-types.ts",
  "lib/growth/media/media-voice-generation-utils.ts",
  "lib/growth/media/media-voice-generation-service.ts",
  "lib/growth/media/media-voice-generation-route-utils.ts",
  "lib/growth/media/media-voice-generation-diagnostics.ts",
  "lib/growth/media/providers/elevenlabs-voice-provider-types.ts",
  "lib/growth/media/providers/elevenlabs-voice-provider.ts",
  "lib/growth/media/providers/elevenlabs-voice-provider-diagnostics.ts",
  "lib/growth/media/media-conversational-agent-types.ts",
  "lib/growth/media/media-conversational-qualification-types.ts",
  "lib/growth/media/media-conversational-session-types.ts",
  "lib/growth/media/media-conversational-session-utils.ts",
  "lib/growth/media/media-conversational-session-service.ts",
  "lib/growth/media/media-conversational-session-route-utils.ts",
  "lib/growth/media/media-conversational-session-diagnostics.ts",
  "lib/growth/media/providers/retell-video-agent-provider-types.ts",
  "lib/growth/media/providers/retell-video-agent-provider.ts",
  "lib/growth/media/providers/retell-video-agent-provider-diagnostics.ts",
  "lib/growth/media/media-ai-qa-types.ts",
  "lib/growth/media/media-ai-qa-policy-types.ts",
  "lib/growth/media/media-ai-qa-knowledge-types.ts",
  "lib/growth/media/media-ai-qa-utils.ts",
  "lib/growth/media/media-ai-qa-service.ts",
  "lib/growth/media/media-ai-qa-route-utils.ts",
  "lib/growth/media/media-ai-qa-diagnostics.ts",
  "lib/growth/media/media-booking-handoff-types.ts",
  "lib/growth/media/media-meeting-readiness-types.ts",
  "lib/growth/media/media-booking-handoff-utils.ts",
  "lib/growth/media/media-booking-handoff-service.ts",
  "lib/growth/media/media-booking-handoff-route-utils.ts",
  "lib/growth/media/media-booking-handoff-diagnostics.ts",
] as const

function probeMediaAssetRouteFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const routePath of GROWTH_MEDIA_ASSET_API_ROUTE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, routePath))
    checks.push({ name: `route:${routePath}`, ok: exists, error: exists ? null : "missing" })
  }

  for (const modulePath of GROWTH_MEDIA_ASSET_MODULE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({ name: `module:${modulePath}`, ok: exists, error: exists ? null : "missing" })
  }

  return checks
}

export async function executeGrowthMediaAssetsProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const schemaProbe = await probeGrowthMediaAssetsSchema(admin)
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = schemaProbe.tables.map((entry) => ({
    name: entry.table,
    ok: entry.ok,
    error: entry.error,
  }))

  if (schemaProbe.ready) {
    const statusProbe = await admin
      .schema("growth")
      .from("media_assets")
      .select("status")
      .in("status", ["draft", "ready", "archived"])
      .limit(1)
    checks.push({
      name: "media_assets.status.check",
      ok: !statusProbe.error,
      error: statusProbe.error?.message ?? null,
    })
  }

  for (const entry of probeMediaAssetRouteFiles()) {
    checks.push({ name: entry.name, ok: entry.ok, error: entry.error })
  }

  const failedChecks = checks.filter((check) => !check.ok)
  const schemaReady = failedChecks.length === 0

  if (!schemaReady) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
      schema_ready: false,
      live_schema_verified: false,
      production_read_only: true,
      route_files_verified: probeMediaAssetRouteFiles().every((entry) => entry.ok),
      migration: GROWTH_MEDIA_ASSETS_MIGRATION,
      error: "schema_drift",
      failed_checks: failedChecks.map((check) => check.name),
      checks,
    }
  }

  const { executeGrowthMediaAssetAnalyticsProductionDiagnostics } = await import(
    "@/lib/growth/media/media-asset-analytics-production-diagnostics"
  )
  const analyticsReport = await executeGrowthMediaAssetAnalyticsProductionDiagnostics(admin)

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    schema_ready: true,
    live_schema_verified: true,
    production_read_only: true,
    route_files_verified: true,
    migration: GROWTH_MEDIA_ASSETS_MIGRATION,
    analytics: analyticsReport,
    checks,
  }
}
