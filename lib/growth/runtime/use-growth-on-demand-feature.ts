"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { shouldDeferGrowthInboxTier3Hydration } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import {
  recordGrowthInboxTier3CacheHit,
  recordGrowthInboxTier3ManualRefresh,
  recordGrowthInboxTier3OnDemandLoad,
} from "@/lib/growth/inbox/growth-inbox-minimal-runtime-metrics"
import { markGrowthInboxExplicitOperatorAction } from "@/lib/growth/inbox/growth-inbox-fetch-audit"
import {
  buildGrowthOnDemandCacheKey,
  readGrowthOnDemandCacheEntry,
  writeGrowthOnDemandCacheEntry,
  type GrowthOnDemandFeatureStatus,
} from "@/lib/growth/runtime/growth-on-demand-feature-cache"

export const GROWTH_ON_DEMAND_FEATURE_QA_MARKER = "growth-on-demand-feature-v1" as const

export function useGrowthOnDemandFeature(input: {
  feature: GrowthFeatureKey
  scopeKey?: string | null
  enabled?: boolean
  load: () => Promise<void>
}): {
  status: GrowthOnDemandFeatureStatus
  error: string | null
  isLoaded: boolean
  load: () => Promise<void>
  refresh: () => Promise<void>
} {
  const cacheKey = buildGrowthOnDemandCacheKey(input.feature, input.scopeKey ?? null)
  const deferTier3 = shouldDeferGrowthInboxTier3Hydration()
  const enabled = input.enabled !== false

  const [status, setStatus] = useState<GrowthOnDemandFeatureStatus>(
    () => readGrowthOnDemandCacheEntry(cacheKey)?.status ?? "idle",
  )
  const [error, setError] = useState<string | null>(() => readGrowthOnDemandCacheEntry(cacheKey)?.error ?? null)

  useEffect(() => {
    const entry = readGrowthOnDemandCacheEntry(cacheKey)
    setStatus(entry?.status ?? "idle")
    setError(entry?.error ?? null)
  }, [cacheKey])

  const loadRef = useRef(input.load)
  loadRef.current = input.load

  const runLoad = useCallback(
    async (mode: "load" | "refresh") => {
      if (!enabled) return

      if (mode === "load") {
        const cached = readGrowthOnDemandCacheEntry(cacheKey)
        if (cached?.status === "loaded") {
          recordGrowthInboxTier3CacheHit(input.feature)
          setStatus("loaded")
          setError(null)
          return
        }
        recordGrowthInboxTier3OnDemandLoad(input.feature)
      } else {
        recordGrowthInboxTier3ManualRefresh(input.feature)
      }

      markGrowthInboxExplicitOperatorAction()
      writeGrowthOnDemandCacheEntry(cacheKey, { status: "loading", error: null })
      setStatus("loading")
      setError(null)

      try {
        await loadRef.current()
        writeGrowthOnDemandCacheEntry(cacheKey, {
          status: "loaded",
          error: null,
          loadedAt: Date.now(),
        })
        setStatus("loaded")
        setError(null)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Could not load intelligence."
        writeGrowthOnDemandCacheEntry(cacheKey, { status: "error", error: message, loadedAt: null })
        setStatus("error")
        setError(message)
      }
    },
    [cacheKey, enabled, input.feature],
  )

  const load = useCallback(async () => {
    await runLoad("load")
  }, [runLoad])

  const refresh = useCallback(async () => {
    await runLoad("refresh")
  }, [runLoad])

  useEffect(() => {
    if (!enabled || deferTier3) return
    void runLoad("load")
  }, [cacheKey, deferTier3, enabled, runLoad])

  return useMemo(
    () => ({
      status,
      error,
      isLoaded: status === "loaded",
      load,
      refresh,
    }),
    [error, load, refresh, status],
  )
}
