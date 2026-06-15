/** Phase GE-HARDEN-2 — Performance thresholds (client-safe). */

import type { ApolloScaleTier } from "@/lib/growth/e2e/growth-engine-performance-types"

export const PERFORMANCE_THRESHOLDS = {
  command_center_workspace_ms: 250,
  lead_workspace_ms: 150,
  metrics_generation_ms: 100,
  timeline_generation_ms: 150,
  agent_orchestration_ms: 200,
  prospect_discovery_plan_ms: 50,
  realtime_normalize_batch_ms: 200,
  realtime_route_batch_ms: 100,
  sequence_preview_ms: 300,
  campaign_builder_ms: 400,
  apollo_workspace_ms: {
    1000: 500,
    5000: 2000,
    10000: 5000,
  } satisfies Record<ApolloScaleTier, number>,
  apollo_memory_mb: {
    1000: 128,
    5000: 256,
    10000: 512,
  } satisfies Record<ApolloScaleTier, number>,
  production_command_center_fetch_ms: 20_000,
  production_agent_orchestration_fetch_ms: 20_000,
  production_inbox_fetch_ms: 15_000,
  production_signal_feed_fetch_ms: 15_000,
  realtime_events_per_second: 500,
  signal_normalize_per_second: 1000,
  db_query_slow_ms: 3000,
} as const

export function apolloWorkspaceThreshold(tier: ApolloScaleTier): number {
  return PERFORMANCE_THRESHOLDS.apollo_workspace_ms[tier]
}

export function apolloMemoryThreshold(tier: ApolloScaleTier): number {
  return PERFORMANCE_THRESHOLDS.apollo_memory_mb[tier]
}
