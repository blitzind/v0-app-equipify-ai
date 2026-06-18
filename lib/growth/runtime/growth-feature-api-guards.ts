/**
 * Phase 8I — server-side API / cron soft-disable guards.
 */

import "server-only"

import { NextResponse } from "next/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { isGrowthFeatureApiEnabled } from "@/lib/growth/runtime/growth-feature-helpers"
import {
  recordGrowthColdStorageApiDisabled,
  recordGrowthColdStorageCronSkipped,
} from "@/lib/growth/runtime/growth-cold-storage-runtime"
import {
  resolveGrowthRuntimeProfileId,
  type GrowthRuntimeProfileId,
} from "@/lib/growth/runtime/growth-runtime-profile"

export const GROWTH_FEATURE_API_GUARD_QA_MARKER = "growth-cold-storage-api-guard-v1" as const

export type GrowthFeatureApiDisabledPayload = {
  ok: true
  disabled: true
  feature: GrowthFeatureKey
  profile: GrowthRuntimeProfileId
  cold_storage: true
  qa_marker: typeof GROWTH_FEATURE_API_GUARD_QA_MARKER
  outreach_enabled: false
  enrollment_enabled: false
}

export function buildGrowthFeatureApiDisabledPayload(
  feature: GrowthFeatureKey,
  profileId?: GrowthRuntimeProfileId,
): GrowthFeatureApiDisabledPayload {
  return {
    ok: true,
    disabled: true,
    feature,
    profile: profileId ?? resolveGrowthRuntimeProfileId(),
    cold_storage: true,
    qa_marker: GROWTH_FEATURE_API_GUARD_QA_MARKER,
    outreach_enabled: false,
    enrollment_enabled: false,
  }
}

function emptyCollectionsForFeature(feature: GrowthFeatureKey): Record<string, unknown> {
  switch (feature) {
    case "campaignBuilder":
      return { wizards: [], total: 0, urgent_count: 0 }
    case "sequencePreviewStudio":
      return { previews: [], total: 0, urgent_count: 0 }
    case "agentOrchestrationDashboard":
      return { plans: [], tasks: [], execution_graph: { nodes: [], edges: [] }, total: 0 }
    case "humanInterventionDashboard":
      return { items: [], total: 0, urgent_count: 0 }
    case "realtimeEventBus":
      return {
        events: [],
        total: 0,
        routed_count: 0,
        pending_count: 0,
        subscription_mode: "unavailable" as const,
      }
    case "diagnosticsDashboards":
      return { dashboard: null, sync_dashboard: null }
    default:
      return {}
  }
}

export function growthFeatureApiDisabledResponse(
  feature: GrowthFeatureKey,
  profileId?: GrowthRuntimeProfileId,
): NextResponse {
  recordGrowthColdStorageApiDisabled(feature)
  const body = {
    ...buildGrowthFeatureApiDisabledPayload(feature, profileId),
    ...emptyCollectionsForFeature(feature),
  }
  return NextResponse.json(body, { status: 200 })
}

/**
 * Soft-disable Tier 2 APIs in operator_minimal before service-role work.
 * Platform admins bypass cold storage under operator_minimal.
 */
export async function guardGrowthFeatureApiRoute(
  feature: GrowthFeatureKey,
  request: Request,
): Promise<NextResponse | null> {
  if (isGrowthFeatureApiEnabled(feature)) return null

  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response
  if (isPlatformAdminEmail(access.userEmail)) return null

  return growthFeatureApiDisabledResponse(feature)
}

/** Cron/background jobs — skip before creating service-role clients. */
export function guardGrowthFeatureCronJob(feature: GrowthFeatureKey): NextResponse | null {
  if (isGrowthFeatureApiEnabled(feature)) return null
  recordGrowthColdStorageCronSkipped(feature)
  return NextResponse.json({
    ok: true,
    disabled: true,
    skipped: true,
    feature,
    profile: resolveGrowthRuntimeProfileId(),
    cold_storage: true,
    qa_marker: GROWTH_FEATURE_API_GUARD_QA_MARKER,
    processed: 0,
  })
}
