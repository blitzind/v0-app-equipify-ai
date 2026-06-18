/**
 * Phase 8I — Tier 2 registry key → API / runtime inventory.
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"

export const GROWTH_FEATURE_API_MAP_VERSION = "8i.1" as const

export type GrowthFeatureApiEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
}

export type GrowthFeatureApiInventoryRow = {
  registryKey: GrowthFeatureKey
  routes: readonly GrowthFeatureApiEndpoint[]
  callers: readonly string[]
  polling: readonly string[]
  subscriptions: readonly string[]
  backgroundJobs: readonly string[]
  supabaseClients: readonly ("service_role" | "user_jwt" | "browser_realtime")[]
  estimatedQueryVolume: "high" | "medium" | "low"
}

const tier2Api = (
  key: GrowthFeatureKey,
  prefix: string,
  extras: Omit<GrowthFeatureApiInventoryRow, "registryKey" | "routes">,
): GrowthFeatureApiInventoryRow => ({
  registryKey: key,
  routes: [
    { method: "GET", path: prefix },
    { method: "POST", path: `${prefix}/actions` },
    { method: "POST", path: `${prefix}/generate` },
    { method: "GET", path: `${prefix}/readiness` },
    { method: "POST", path: `${prefix}/execute` },
  ],
  ...extras,
})

export const GROWTH_TIER2_API_INVENTORY: readonly GrowthFeatureApiInventoryRow[] = [
  tier2Api("campaignBuilder", "/api/platform/growth/campaign-builder", {
    callers: ["GrowthCampaignBuilderWizardPanel", "natural-language-discovery-panel"],
    polling: ["useGrowthRealtimeRefresh(campaign_builder)", "subscribeToGrowthRealtimeEvents"],
    subscriptions: ["realtime-events-subscriber"],
    backgroundJobs: [],
    supabaseClients: ["service_role"],
    estimatedQueryVolume: "medium",
  }),
  tier2Api("sequencePreviewStudio", "/api/platform/growth/sequence-preview", {
    callers: ["GrowthSequencePreviewStudioPanel", "GrowthSequencePatternBuilder"],
    polling: ["useGrowthRealtimeRefresh(sequence_preview)"],
    subscriptions: ["realtime-events-subscriber"],
    backgroundJobs: [],
    supabaseClients: ["service_role"],
    estimatedQueryVolume: "medium",
  }),
  tier2Api("agentOrchestrationDashboard", "/api/platform/growth/agent-orchestration", {
    callers: ["GrowthAgentOrchestrationPanel"],
    polling: ["useGrowthRealtimeRefresh(agent_orchestration)"],
    subscriptions: ["realtime-events-subscriber"],
    backgroundJobs: [],
    supabaseClients: ["service_role"],
    estimatedQueryVolume: "high",
  }),
  tier2Api("humanInterventionDashboard", "/api/platform/growth/human-interventions", {
    callers: ["GrowthHumanInterventionsPanel"],
    polling: ["useGrowthRealtimeRefresh(human_interventions)"],
    subscriptions: ["realtime-events-subscriber"],
    backgroundJobs: [],
    supabaseClients: ["service_role"],
    estimatedQueryVolume: "medium",
  }),
  {
    registryKey: "realtimeEventBus",
    routes: [
      { method: "GET", path: "/api/platform/growth/realtime-events" },
      { method: "POST", path: "/api/platform/growth/realtime-events/actions" },
      { method: "POST", path: "/api/platform/growth/realtime-events/publish" },
      { method: "GET", path: "/api/platform/growth/realtime-events/readiness" },
      { method: "POST", path: "/api/platform/growth/realtime-events/execute" },
    ],
    callers: ["GrowthRealtimeEventBusPanel", "realtime-events-subscriber", "useGrowthRealtimeRefresh"],
    polling: ["subscribeToGrowthRealtimeEvents pollingIntervalMs", "useGrowthRealtimeRefresh"],
    subscriptions: ["supabase.channel(growth-realtime-events-*)", "postgres_changes signal_events"],
    backgroundJobs: [],
    supabaseClients: ["service_role", "browser_realtime"],
    estimatedQueryVolume: "high",
  },
  {
    registryKey: "diagnosticsDashboards",
    routes: [{ method: "GET", path: "/api/platform/growth/inbox/sync/dashboard" }],
    callers: ["GrowthInboxDiagnosticsPanel", "GrowthInboxWorkspaceProvider.loadSecondaryInboxData"],
    polling: [],
    subscriptions: [],
    backgroundJobs: ["growth-provider-runtime-diagnostics cron"],
    supabaseClients: ["service_role", "user_jwt"],
    estimatedQueryVolume: "medium",
  },
  {
    registryKey: "executionGraphs",
    routes: [{ method: "GET", path: "/api/platform/growth/agent-orchestration" }],
    callers: ["GrowthAgentOrchestrationPanel execution_graph field"],
    polling: [],
    subscriptions: [],
    backgroundJobs: [],
    supabaseClients: ["service_role"],
    estimatedQueryVolume: "low",
  },
  {
    registryKey: "workflowSummaryAutofetch",
    routes: [],
    callers: ["GrowthInboxWorkflowIntelligenceSummary (shell-gated Phase 8H)"],
    polling: ["useGrowthConversationsDashboard", "useGrowthReplyIntelligenceDashboard"],
    subscriptions: [],
    backgroundJobs: [],
    supabaseClients: ["user_jwt"],
    estimatedQueryVolume: "low",
  },
] as const

export const GROWTH_TIER2_API_PATH_PREFIXES: readonly { prefix: string; feature: GrowthFeatureKey }[] = [
  { prefix: "/api/platform/growth/campaign-builder", feature: "campaignBuilder" },
  { prefix: "/api/platform/growth/sequence-preview", feature: "sequencePreviewStudio" },
  { prefix: "/api/platform/growth/agent-orchestration", feature: "agentOrchestrationDashboard" },
  { prefix: "/api/platform/growth/human-interventions", feature: "humanInterventionDashboard" },
  { prefix: "/api/platform/growth/realtime-events", feature: "realtimeEventBus" },
  { prefix: "/api/platform/growth/inbox/sync/dashboard", feature: "diagnosticsDashboards" },
]

export function resolveGrowthFeatureKeyFromApiPath(pathname: string): GrowthFeatureKey | null {
  for (const row of GROWTH_TIER2_API_PATH_PREFIXES) {
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) {
      return row.feature
    }
  }
  return null
}

export function listGrowthTier2ApiPaths(): string[] {
  return GROWTH_TIER2_API_INVENTORY.flatMap((row) => row.routes.map((r) => r.path))
}

export function getGrowthFeatureApiInventory(key: GrowthFeatureKey): GrowthFeatureApiInventoryRow | null {
  return GROWTH_TIER2_API_INVENTORY.find((row) => row.registryKey === key) ?? null
}
