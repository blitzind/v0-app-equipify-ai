/** Phase GE-HARDEN-3 — Diagnostics builder (client-safe). */

import type { GrowthEngineDiagnosticsSummary } from "@/lib/growth/e2e/growth-engine-hardening-types"

export function buildGrowthEngineDiagnosticsSummary(input: {
  command_center_fetch_ms?: number | null
  agent_orchestration_fetch_ms?: number | null
  operator_inbox_fetch_ms?: number | null
  signal_feed_fetch_ms?: number | null
  event_routing_ms?: number | null
  realtime_subscription_mode?: "realtime" | "polling" | "unavailable" | null
  polling_fallback_active?: boolean
  error_count?: number
  retry_count?: number
  stale_data_detected?: boolean
  persisted_audit_event_id?: string | null
}): GrowthEngineDiagnosticsSummary {
  const totalFetches = [
    input.command_center_fetch_ms,
    input.agent_orchestration_fetch_ms,
    input.operator_inbox_fetch_ms,
    input.signal_feed_fetch_ms,
  ].filter((v) => v != null).length

  const errorCount = input.error_count ?? 0
  const retryCount = input.retry_count ?? 0

  return {
    command_center_fetch_ms: input.command_center_fetch_ms ?? null,
    agent_orchestration_fetch_ms: input.agent_orchestration_fetch_ms ?? null,
    operator_inbox_fetch_ms: input.operator_inbox_fetch_ms ?? null,
    signal_feed_fetch_ms: input.signal_feed_fetch_ms ?? null,
    event_routing_ms: input.event_routing_ms ?? null,
    realtime_subscription_mode: input.realtime_subscription_mode ?? "polling",
    polling_fallback_active: input.polling_fallback_active ?? true,
    error_rate: totalFetches > 0 ? Math.round((errorCount / totalFetches) * 100) / 100 : 0,
    retry_rate: totalFetches > 0 ? Math.round((retryCount / totalFetches) * 100) / 100 : 0,
    stale_data_detected: input.stale_data_detected ?? false,
    persisted_audit_event_id: input.persisted_audit_event_id ?? null,
  }
}

export function detectStaleData(input: {
  generated_at?: string | null
  max_age_ms?: number
}): boolean {
  if (!input.generated_at) return false
  const age = Date.now() - new Date(input.generated_at).getTime()
  return age > (input.max_age_ms ?? 5 * 60_000)
}
