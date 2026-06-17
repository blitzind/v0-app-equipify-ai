"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchGrowthConversationsDashboard,
  type GrowthConversationsDashboardPayload,
} from "@/lib/growth/conversations/growth-conversations-dashboard-client"

export function useGrowthConversationsDashboard() {
  const [dashboard, setDashboard] = useState<GrowthConversationsDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchGrowthConversationsDashboard()
      setDashboard(next)
    } catch (e) {
      setDashboard(null)
      setError(e instanceof Error ? e.message : "Conversation intelligence unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { dashboard, loading, error, reload: load }
}
