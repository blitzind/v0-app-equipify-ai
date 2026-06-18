/**
 * Phase 8K — lightweight Inbox minimal runtime diagnostics (client + server merge helper).
 */

import { getGrowthInboxMinimalRuntimeMetrics } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-metrics"
import {
  GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES,
  GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER,
  GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES,
  GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES,
  isGrowthInboxMinimalRuntimeActive,
} from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import { getGrowthInboxFetchAuditLifecycle } from "@/lib/growth/inbox/growth-inbox-fetch-audit"
import { resolveGrowthRuntimeProfileId } from "@/lib/growth/runtime/growth-runtime-profile"

export const GROWTH_INBOX_MINIMAL_RUNTIME_DIAGNOSTICS_VERSION = "8k.1" as const

export function summarizeGrowthInboxMinimalRuntimeDiagnostics() {
  const metrics = getGrowthInboxMinimalRuntimeMetrics()
  return {
    version: GROWTH_INBOX_MINIMAL_RUNTIME_DIAGNOSTICS_VERSION,
    qaMarker: GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER,
    profileId: resolveGrowthRuntimeProfileId(),
    minimalRuntimeActive: isGrowthInboxMinimalRuntimeActive(),
    lifecycle: getGrowthInboxFetchAuditLifecycle(),
    allowlists: {
      initial: [...GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES],
      selectedThread: [...GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES],
      tier3OnDemand: [...GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES],
    },
    metrics: {
      allowedInitialRequests: metrics.allowedInitialRequests,
      blockedOrFlaggedInitialRequests: metrics.blockedOrFlaggedInitialRequests,
      allowedSelectedThreadRequests: metrics.allowedSelectedThreadRequests,
      flaggedTier3EagerRequests: metrics.flaggedTier3EagerRequests,
      tier2SoftDisabledRequests: metrics.tier2SoftDisabledRequests,
      tier3OnDemandLoads: metrics.tier3OnDemandLoads,
      tier3CacheHits: metrics.tier3CacheHits,
      tier3ManualRefreshes: metrics.tier3ManualRefreshes,
      tier3LoadsByFeature: metrics.tier3LoadsByFeature,
    },
    recentFlaggedRoutes: metrics.flaggedRoutes.slice(-10),
  }
}
