"use client"

import { useEffect, useState } from "react"
import {
  fetchGrowthLeadsHubMetrics,
  type GrowthLeadsHubMetricsSnapshot,
} from "@/lib/growth/hubs/growth-leads-hub-metrics-client"

const EMPTY_METRICS: GrowthLeadsHubMetricsSnapshot = {
  queueDepth: null,
  capturedToday: null,
  readyToCall: null,
  researchRuns: null,
  accountsAwaitingResearch: null,
  needFollowUp: null,
  leadsAwaitingResearch: null,
  meetingsScheduled: null,
  followUpsOverdue: null,
  nextReadyCallLabel: null,
  highPriorityCount: null,
  needsReviewCount: null,
  enrichmentNeededCount: null,
}

export function useGrowthLeadsHubMetrics() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<GrowthLeadsHubMetricsSnapshot>(EMPTY_METRICS)

  useEffect(() => {
    const ac = new AbortController()
    void fetchGrowthLeadsHubMetrics(ac.signal)
      .then(setMetrics)
      .catch(() => setMetrics(EMPTY_METRICS))
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { loading, metrics }
}
