"use client"

import { useEffect, useState } from "react"
import {
  fetchGrowthCampaignsHubMetrics,
  type GrowthCampaignsHubMetricsSnapshot,
} from "@/lib/growth/hubs/growth-campaigns-hub-metrics-client"

const EMPTY_METRICS: GrowthCampaignsHubMetricsSnapshot = {
  prospectsEnteredToday: 0,
  prospectsNeedFollowUp: 0,
  meetingsBooked: 0,
  campaignsNeedAttention: 0,
  overdueFollowUps: 0,
  repliesAwaitingReview: 0,
  runningNormally: 0,
  needsAttention: 0,
  stalledCampaigns: 0,
  emailsSent: 0,
  openRate: 0,
  replyRate: 0,
  pipelineCreated: 0,
  channelTasksDue: 0,
  taskQueue: [],
  recentEvents: [],
  routingRules: [],
  channelPerformance: [],
}

export function useGrowthCampaignsHubMetrics() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<GrowthCampaignsHubMetricsSnapshot>(EMPTY_METRICS)

  useEffect(() => {
    const ac = new AbortController()
    void fetchGrowthCampaignsHubMetrics(ac.signal)
      .then(setMetrics)
      .catch(() => setMetrics(EMPTY_METRICS))
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { loading, metrics }
}
