/**
 * Phase 8J — Inbox minimal runtime contract for `operator_minimal`.
 *
 * Documents which network requests are allowed on initial load vs selected-thread vs on-demand.
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { resolveGrowthRuntimeProfileId } from "@/lib/growth/runtime/growth-runtime-profile"

export const GROWTH_INBOX_MINIMAL_RUNTIME_QA_MARKER = "growth-inbox-minimal-runtime-v1" as const

export type GrowthInboxRequestPhase = "initial" | "selected_thread" | "on_demand"

export type GrowthInboxRequestDisposition = "keep" | "lazy" | "disable"

export type GrowthInboxMinimalRuntimeRequestRow = {
  source: string
  route: string
  tier: 1 | 2 | 3
  phase: GrowthInboxRequestPhase
  disposition: GrowthInboxRequestDisposition
}

/** Initial paint allowlist — operator_minimal Inbox tab. */
export const GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES = [
  "/api/platform/growth/inbox",
  "/api/platform/growth/inbox/dashboard",
  "/api/platform/growth/operator-inbox",
  "/api/growth/workspace/settings/default-views",
] as const

/** Selected-thread Tier 1 essentials (after explicit or implicit thread selection). */
export const GROWTH_INBOX_MINIMAL_SELECTED_THREAD_ROUTES = [
  "/api/platform/growth/inbox/thread/{id}",
  "/api/platform/growth/leads/{leadId}",
  "/api/platform/growth/replies/timeline",
  "/api/platform/growth/lead-memory/profile/{leadId}",
  "/api/platform/growth/replies/copilot",
  "/api/platform/growth/replies/workflow-actions",
] as const

/** Tier 3 — click-to-load only in operator_minimal. */
export const GROWTH_INBOX_TIER3_ON_DEMAND_ROUTES = [
  "/api/platform/growth/revenue-execution/command-center",
  "/api/platform/growth/revenue-execution/forecast-evidence",
  "/api/platform/growth/revenue-execution/execution-plan",
  "/api/platform/growth/replies/sequence-exit-candidates",
  "/api/platform/growth/opportunities/dashboard",
  "/api/platform/growth/booking-intelligence/recommendations",
  "/api/platform/growth/replies/dashboard",
  "/api/platform/growth/calls/queue",
  "/api/platform/growth/calls/dashboard",
  "/api/platform/growth/conversations/dashboard",
] as const

export const GROWTH_INBOX_MINIMAL_RUNTIME_INVENTORY: readonly GrowthInboxMinimalRuntimeRequestRow[] = [
  { source: "GrowthInboxWorkspaceProvider.load", route: "/api/platform/growth/inbox", tier: 1, phase: "initial", disposition: "keep" },
  { source: "GrowthInboxWorkspaceProvider.load", route: "/api/platform/growth/inbox/dashboard", tier: 1, phase: "initial", disposition: "keep" },
  { source: "GrowthOperatorInboxPanel", route: "/api/platform/growth/operator-inbox", tier: 1, phase: "initial", disposition: "keep" },
  { source: "GrowthInboxQueueUrlSync", route: "/api/growth/workspace/settings/default-views", tier: 1, phase: "initial", disposition: "keep" },
  { source: "GrowthInboxWorkspaceProvider.loadSecondaryInboxData", route: "/api/platform/growth/inbox/sync/dashboard", tier: 2, phase: "initial", disposition: "disable" },
  { source: "GrowthInboxWorkspaceProvider.loadSecondaryInboxData", route: "/api/platform/growth/mailboxes", tier: 1, phase: "initial", disposition: "lazy" },
  { source: "useGrowthReplyIntelligenceDashboard", route: "/api/platform/growth/replies/dashboard", tier: 1, phase: "initial", disposition: "lazy" },
  { source: "useGrowthInboxCallCommunications", route: "/api/platform/growth/calls/queue", tier: 1, phase: "initial", disposition: "lazy" },
  { source: "useGrowthInboxCallCommunications", route: "/api/platform/growth/calls/dashboard", tier: 1, phase: "initial", disposition: "lazy" },
  { source: "GrowthInboxLeadContextProvider", route: "/api/platform/growth/leads/{leadId}", tier: 1, phase: "selected_thread", disposition: "keep" },
  { source: "GrowthInboxLeadContextProvider", route: "/api/platform/growth/replies/timeline", tier: 1, phase: "selected_thread", disposition: "keep" },
  { source: "GrowthInboxLeadContextProvider", route: "/api/platform/growth/lead-memory/profile/{leadId}", tier: 1, phase: "selected_thread", disposition: "keep" },
  { source: "GrowthInboxLeadContextProvider", route: "/api/platform/growth/replies/copilot", tier: 1, phase: "selected_thread", disposition: "keep" },
  { source: "GrowthInboxLeadContextProvider.refreshWorkflow", route: "/api/platform/growth/replies/workflow-actions", tier: 1, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxLeadContextProvider.refreshWorkflow", route: "/api/platform/growth/replies/sequence-exit-candidates", tier: 3, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxSharedDataProvider", route: "/api/platform/growth/revenue-execution/command-center", tier: 3, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxLeadContextProvider.refreshRecommendations", route: "/api/platform/growth/opportunities/dashboard", tier: 3, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxLeadContextProvider.refreshRecommendations", route: "/api/platform/growth/booking-intelligence/recommendations", tier: 3, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxLeadContextProvider.refreshLeadEnrichment", route: "/api/platform/growth/revenue-execution/forecast-evidence", tier: 3, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxLeadContextProvider.refreshLeadEnrichment", route: "/api/platform/growth/revenue-execution/execution-plan", tier: 3, phase: "on_demand", disposition: "lazy" },
  { source: "GrowthInboxWorkflowIntelligenceSummary", route: "/api/platform/growth/conversations/dashboard", tier: 2, phase: "initial", disposition: "disable" },
  { source: "useGrowthRealtimeRefresh", route: "/api/platform/growth/realtime-events", tier: 2, phase: "initial", disposition: "disable" },
  { source: "useGrowthInboxTier1Refresh", route: "Tier 1 poll: inbox + operator-inbox + thread", tier: 1, phase: "initial", disposition: "keep" },
] as const

const TIER3_FEATURE_KEYS: GrowthFeatureKey[] = [
  "conversationalPlaybooks",
  "smartFollowUpPolicies",
  "sequenceExitCandidates",
  "revenueCommandCenter",
  "forecastEvidence",
  "executionPlans",
  "bookingIntelligence",
  "opportunityRecommendations",
]

export function isGrowthInboxMinimalRuntimeActive(): boolean {
  return resolveGrowthRuntimeProfileId() === "operator_minimal"
}

export function shouldSkipGrowthInboxSecondaryHydration(): boolean {
  return isGrowthInboxMinimalRuntimeActive()
}

export function shouldDeferGrowthInboxTier3Hydration(): boolean {
  return isGrowthInboxMinimalRuntimeActive()
}

export function isGrowthInboxTier3Feature(key: GrowthFeatureKey): boolean {
  return (TIER3_FEATURE_KEYS as readonly string[]).includes(key)
}

export function isGrowthInboxInitialLoadRouteAllowed(pathname: string): boolean {
  return (GROWTH_INBOX_MINIMAL_INITIAL_LOAD_ROUTES as readonly string[]).some(
    (route) => pathname === route || pathname.startsWith(`${route}?`),
  )
}
