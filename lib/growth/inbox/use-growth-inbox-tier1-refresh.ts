"use client"

import { useEffect, useRef } from "react"
import { isGrowthInboxMinimalRuntimeActive } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import { isGrowthFeatureApiEnabled } from "@/lib/growth/runtime/growth-feature-helpers"

export const GROWTH_INBOX_TIER1_REFRESH_QA_MARKER = "growth-inbox-tier1-refresh-v1" as const

/** Conservative bounded polling for operator-critical inbox updates — no event bus. */
export const GROWTH_INBOX_TIER1_REFRESH_INTERVAL_MS = 90_000 as const

/**
 * Tier 1-native refresh when realtime event bus is cold (operator_minimal default).
 * Polls existing Tier 1 endpoints only — no diagnostics, no workflow summary, no event bus.
 */
export function useGrowthInboxTier1Refresh(input: {
  onRefresh: () => void
  enabled?: boolean
  intervalMs?: number
}): void {
  const onRefreshRef = useRef(input.onRefresh)
  onRefreshRef.current = input.onRefresh

  useEffect(() => {
    if (input.enabled === false) return

    const eventBusCold = !isGrowthFeatureApiEnabled("realtimeEventBus")
    if (!eventBusCold && !isGrowthInboxMinimalRuntimeActive()) return

    const intervalMs = input.intervalMs ?? GROWTH_INBOX_TIER1_REFRESH_INTERVAL_MS
    const timer = setInterval(() => {
      onRefreshRef.current()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [input.enabled, input.intervalMs])
}
