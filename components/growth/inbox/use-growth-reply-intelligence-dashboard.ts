"use client"

import { useCallback, useEffect, useState } from "react"
import type { GrowthSalesExecutionDashboard } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { fetchGrowthReplyIntelligenceDashboard } from "@/lib/growth/replies/growth-reply-intelligence-dashboard-client"
import { scheduleGrowthInboxIdleTask } from "@/lib/growth/inbox/inbox-load-scheduler"
import { shouldSkipGrowthInboxSecondaryHydration } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"

export function useGrowthReplyIntelligenceDashboard(options?: { deferLoad?: boolean }) {
  const deferLoad = options?.deferLoad ?? false
  const [dashboard, setDashboard] = useState<GrowthSalesExecutionDashboard | null>(null)
  const [loading, setLoading] = useState(!deferLoad)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchGrowthReplyIntelligenceDashboard()
      setDashboard(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply intelligence unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (deferLoad) {
      if (shouldSkipGrowthInboxSecondaryHydration()) return
      const cancelIdle = scheduleGrowthInboxIdleTask(() => {
        void load()
      })
      return cancelIdle
    }
    void load()
  }, [deferLoad, load])

  return { dashboard, loading, error, reload: load }
}
