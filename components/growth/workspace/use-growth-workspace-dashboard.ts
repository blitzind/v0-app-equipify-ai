"use client"

import { useCallback, useEffect, useState } from "react"
import {
  GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
  GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
} from "@/lib/growth/home/growth-home-workspace-api-contract"
import {
  normalizeGrowthHomeWorkspaceSummaryPayload,
} from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

const EMPTY_SOURCES: GrowthWorkspaceDashboardSourcePayload = {
  briefing: null,
  leadInboxSections: [],
  cadenceSummary: null,
  pipelineDashboard: null,
  opportunityReadiness: null,
  sequenceFoundation: null,
  sequenceExecution: null,
  engagementWorkspace: null,
  conversationDashboard: null,
  relationshipDashboard: null,
  callsDashboard: null,
  dailyRevenueWorkQueueEnabled: false,
  dailyRevenueWorkQueue: null,
  dailyRevenueWorkQueueDisplay: null,
}

const GROWTH_HOME_WORKSPACE_SUMMARY_FETCH_TIMEOUT_MS = 45_000

async function fetchGrowthHomeWorkspaceSummary(): Promise<{
  payload: GrowthHomeWorkspaceSummaryPayload | null
  errorMessage: string | null
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GROWTH_HOME_WORKSPACE_SUMMARY_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, {
      cache: "no-store",
      signal: controller.signal,
    })
    const payload = (await res.json().catch(() => ({}))) as Partial<GrowthHomeWorkspaceSummaryPayload>
    if (!res.ok || payload.ok !== true) {
      const message =
        typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Could not load workspace dashboard."
      return { payload: null, errorMessage: message }
    }
    return { payload: normalizeGrowthHomeWorkspaceSummaryPayload(payload), errorMessage: null }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError"
    return {
      payload: null,
      errorMessage: timedOut
        ? "Home is taking longer than expected. Please retry in a moment."
        : error instanceof Error
          ? error.message
          : "Could not load workspace dashboard.",
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function logHomeDashboardFetch(payload: GrowthHomeWorkspaceSummaryPayload | null): void {
  if (typeof window === "undefined") return
  console.info("[growth/home/dashboard-fetch]", {
    batch: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    endpoint: GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
    fetched_at: new Date().toISOString(),
    api_calls: 1,
    legacy_api_calls_eliminated: 11,
    duration_ms: payload?.optimization?.durationMs ?? null,
    revenue_queue_total: payload?.revenueQueue?.total ?? null,
    list_growth_leads_calls: payload?.optimization?.listGrowthLeadsCalls ?? null,
  })
}

/** Single canonical load — GET /home/workspace-summary (GE-SIMPLIFY-1B). */
export async function loadGrowthWorkspaceDashboardSources(): Promise<GrowthWorkspaceDashboardSourcePayload> {
  const { payload } = await fetchGrowthHomeWorkspaceSummary()
  logHomeDashboardFetch(payload)
  return payload?.sources ?? EMPTY_SOURCES
}

export function useGrowthWorkspaceDashboard() {
  const [dashboard, setDashboard] = useState<GrowthWorkspaceDashboardViewModel | null>(null)
  const [workspaceSummary, setWorkspaceSummary] = useState<GrowthHomeWorkspaceSummaryPayload | null>(null)
  const [avaConsole, setAvaConsole] = useState<GrowthHomeWorkspaceSummaryPayload["avaConsole"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { payload, errorMessage } = await fetchGrowthHomeWorkspaceSummary()
    logHomeDashboardFetch(payload)

    if (!payload) {
      setError(errorMessage)
      setDashboard(buildGrowthWorkspaceDashboardViewModel(EMPTY_SOURCES))
      setWorkspaceSummary(null)
      setAvaConsole(null)
    } else {
      setDashboard(payload.dashboard ?? buildGrowthWorkspaceDashboardViewModel(payload.sources))
      setWorkspaceSummary(payload)
      setAvaConsole(payload.avaConsole ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    dashboard,
    workspaceSummary,
    avaConsole,
    loading,
    error,
    reload,
    fetchBatchMarker: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    debugSourcePath: GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  }
}
