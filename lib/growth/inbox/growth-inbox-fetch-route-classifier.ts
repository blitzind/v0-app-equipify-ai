/**
 * Phase 8K — classify Growth Inbox fetch URLs for audit + metrics.
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import {
  GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES,
  GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES,
  GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES,
  isGrowthInboxTier3Feature,
} from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"

export const GROWTH_INBOX_FETCH_ROUTE_CLASSIFIER_VERSION = "8k.1" as const

const TIER3_ROUTE_TO_FEATURE: Array<{ prefix: string; feature: GrowthFeatureKey }> = [
  { prefix: "/api/platform/growth/revenue-execution/command-center", feature: "revenueCommandCenter" },
  { prefix: "/api/platform/growth/revenue-execution/forecast-evidence", feature: "forecastEvidence" },
  { prefix: "/api/platform/growth/revenue-execution/execution-plan", feature: "executionPlans" },
  { prefix: "/api/platform/growth/replies/sequence-exit-candidates", feature: "sequenceExitCandidates" },
  { prefix: "/api/platform/growth/opportunities/dashboard", feature: "opportunityRecommendations" },
  { prefix: "/api/platform/growth/booking-intelligence/recommendations", feature: "bookingIntelligence" },
  { prefix: "/api/platform/growth/conversations/dashboard", feature: "conversationalPlaybooks" },
]

const TIER2_ROUTE_PREFIXES = [
  "/api/platform/growth/inbox/sync/dashboard",
  "/api/platform/growth/realtime-events",
  "/api/platform/growth/campaign-builder",
  "/api/platform/growth/sequence-preview",
  "/api/platform/growth/agent-orchestration",
  "/api/platform/growth/human-interventions",
  "/api/platform/growth/conversations/dashboard",
] as const

export type GrowthInboxFetchRouteClassification = {
  pathname: string
  tier: 1 | 2 | 3 | "unknown"
  feature: GrowthFeatureKey | null
  isInitialAllowed: boolean
  isSelectedThreadAllowed: boolean
  isTier3OnDemand: boolean
  isTier2Route: boolean
}

function normalizeGrowthInboxFetchPath(input: RequestInfo | URL): string | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url
  if (!raw.includes("/api/")) return null

  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, "http://localhost")
    return url.pathname
  } catch {
    const pathOnly = raw.split("?")[0] ?? raw
    return pathOnly.startsWith("/") ? pathOnly : null
  }
}

function matchesTemplate(pathname: string, template: string): boolean {
  if (template.includes("{")) {
    const prefix = template.split("{")[0] ?? template
    return pathname.startsWith(prefix)
  }
  return pathname === template || pathname.startsWith(`${template}/`)
}

function isRouteInList(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => matchesTemplate(pathname, route))
}

export function resolveGrowthInboxTier3FeatureFromPath(pathname: string): GrowthFeatureKey | null {
  for (const row of TIER3_ROUTE_TO_FEATURE) {
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`) || pathname.startsWith(`${row.prefix}?`)) {
      return row.feature
    }
  }
  return null
}

export function classifyGrowthInboxFetchRoute(input: RequestInfo | URL): GrowthInboxFetchRouteClassification | null {
  const pathname = normalizeGrowthInboxFetchPath(input)
  if (!pathname) return null
  if (!pathname.startsWith("/api/platform/growth/") && !pathname.startsWith("/api/growth/")) return null

  const tier3Feature = resolveGrowthInboxTier3FeatureFromPath(pathname)
  const isTier3OnDemand = isRouteInList(pathname, GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES) || tier3Feature != null
  const isTier2Route = TIER2_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isInitialAllowed = isRouteInList(pathname, GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES)
  const isSelectedThreadAllowed = isRouteInList(pathname, GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES)

  let tier: 1 | 2 | 3 | "unknown" = "unknown"
  if (isTier2Route) tier = 2
  else if (isTier3OnDemand) tier = 3
  else if (isInitialAllowed || isSelectedThreadAllowed) tier = 1

  const feature = tier3Feature

  return {
    pathname,
    tier,
    feature: feature && isGrowthInboxTier3Feature(feature) ? feature : tier3Feature,
    isInitialAllowed,
    isSelectedThreadAllowed,
    isTier3OnDemand,
    isTier2Route,
  }
}
