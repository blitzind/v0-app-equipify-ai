import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countGrowthSendrEngagementEventsToday } from "@/lib/growth/sendr/growth-sendr-engagement-event-service"
import {
  countGrowthSendrLandingPagesCreatedToday,
  countGrowthSendrLandingPagesPublishedToday,
  listGrowthSendrLandingPages,
} from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import {
  countGrowthSendrMediaAssetsCreatedToday,
  listGrowthSendrMediaAssets,
} from "@/lib/growth/sendr/growth-sendr-media-asset-repository"
import { getGrowthSendrObservabilitySnapshot } from "@/lib/growth/sendr/growth-sendr-observability"
import { probeSendrSchemaReady } from "@/lib/growth/sendr/growth-sendr-schema-health"
import type { GrowthSendrWorkspaceSummary } from "@/lib/growth/sendr/growth-sendr-types"
import { getGrowthSendrWorkspaceMetrics } from "@/lib/growth/sendr/growth-sendr-workspace-metrics-service"
import { getGrowthSendrWorkspaceIntelligence } from "@/lib/growth/sendr/growth-sendr-workspace-intelligence-service"

function startOfUtcDay(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function getGrowthSendrWorkspaceSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthSendrWorkspaceSummary> {
  const dayStart = startOfUtcDay()
  const [pages, assets, observability, schemaReady, metrics, intelligence] = await Promise.all([
    listGrowthSendrLandingPages(admin, { organizationId, limit: 10 }),
    listGrowthSendrMediaAssets(admin, { organizationId, limit: 10 }),
    getGrowthSendrObservabilitySnapshot(admin, { organizationId }),
    probeSendrSchemaReady(admin),
    getGrowthSendrWorkspaceMetrics(admin, organizationId).catch(() => null),
    getGrowthSendrWorkspaceIntelligence(admin, organizationId).catch(() => null),
  ])

  const [pagesPublishedToday, pagesCreatedToday, assetsCreatedToday, engagementEventsToday] =
    await Promise.all([
      countGrowthSendrLandingPagesPublishedToday(admin, organizationId, dayStart),
      countGrowthSendrLandingPagesCreatedToday(admin, organizationId, dayStart),
      countGrowthSendrMediaAssetsCreatedToday(admin, organizationId, dayStart),
      countGrowthSendrEngagementEventsToday(admin, organizationId, dayStart),
    ])

  return {
    recentPages: pages.items,
    recentMediaAssets: assets.items,
    pagesPublishedToday,
    pagesCreatedToday,
    assetsCreatedToday,
    engagementEventsToday,
    failuresToday: observability.failuresToday,
    throttlesToday: observability.throttlesToday,
    schemaReady,
    metrics: metrics ?? undefined,
    intelligence: intelligence ?? undefined,
  }
}

export { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
