"use client"

import { useCallback, useEffect, useState } from "react"
import type { GrowthSalesExecutionDashboard } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { fetchGrowthReplyIntelligenceDashboard } from "@/lib/growth/replies/growth-reply-intelligence-dashboard-client"

export function useGrowthReplyIntelligenceDashboard() {
  const [dashboard, setDashboard] = useState<GrowthSalesExecutionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
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
    void load()
  }, [load])

  return { dashboard, loading, error, reload: load }
}
