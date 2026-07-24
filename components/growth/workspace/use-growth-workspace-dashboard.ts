"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
  GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
} from "@/lib/growth/home/growth-home-workspace-api-contract"
import {
  GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS,
  readGrowthHomeExecutiveSessionCache,
  writeGrowthHomeExecutiveSessionCache,
} from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
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

function applyWorkspaceSummaryPayload(
  payload: GrowthHomeWorkspaceSummaryPayload,
): {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload
  avaConsole: GrowthHomeWorkspaceSummaryPayload["avaConsole"]
} {
  return {
    dashboard: payload.dashboard ?? buildGrowthWorkspaceDashboardViewModel(payload.sources),
    workspaceSummary: payload,
    avaConsole: payload.avaConsole ?? null,
  }
}

function readInitialExecutiveCache(): GrowthHomeWorkspaceSummaryPayload | null {
  return readGrowthHomeExecutiveSessionCache()
}

async function fetchGrowthHomeWorkspaceSummary(): Promise<{
  payload: GrowthHomeWorkspaceSummaryPayload | null
  errorMessage: string | null
  timedOut: boolean
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS,
  )
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
      return { payload: null, errorMessage: message, timedOut: false }
    }
    return {
      payload: normalizeGrowthHomeWorkspaceSummaryPayload(payload),
      errorMessage: null,
      timedOut: false,
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError"
    return {
      payload: null,
      errorMessage: timedOut
        ? "Home is taking longer than expected. Please retry in a moment."
        : error instanceof Error
          ? error.message
          : "Could not load workspace dashboard.",
      timedOut,
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
    executive_load: payload?.executiveLoad ?? null,
  })
}

/** Single canonical load — GET /home/workspace-summary (GE-SIMPLIFY-1B). */
export async function loadGrowthWorkspaceDashboardSources(): Promise<GrowthWorkspaceDashboardSourcePayload> {
  const { payload } = await fetchGrowthHomeWorkspaceSummary()
  logHomeDashboardFetch(payload)
  if (payload) {
    writeGrowthHomeExecutiveSessionCache(payload)
    return payload.sources
  }
  const cached = readGrowthHomeExecutiveSessionCache()
  return cached?.sources ?? EMPTY_SOURCES
}

export function useGrowthWorkspaceDashboard() {
  const initialCache = readInitialExecutiveCache()
  const initialApplied = initialCache ? applyWorkspaceSummaryPayload(initialCache) : null

  const [dashboard, setDashboard] = useState<GrowthWorkspaceDashboardViewModel | null>(
    initialApplied?.dashboard ?? null,
  )
  const [workspaceSummary, setWorkspaceSummary] = useState<GrowthHomeWorkspaceSummaryPayload | null>(
    initialApplied?.workspaceSummary ?? null,
  )
  const [avaConsole, setAvaConsole] = useState<GrowthHomeWorkspaceSummaryPayload["avaConsole"] | null>(
    initialApplied?.avaConsole ?? null,
  )
  const [loading, setLoading] = useState(!initialApplied)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestSequenceRef = useRef(0)
  const workspaceSummaryRef = useRef(workspaceSummary)
  workspaceSummaryRef.current = workspaceSummary

  const reload = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current
    const hasConfirmedExecutiveState = Boolean(workspaceSummaryRef.current)
    if (hasConfirmedExecutiveState) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    const { payload, errorMessage } = await fetchGrowthHomeWorkspaceSummary()
    if (requestSequence !== requestSequenceRef.current) {
      return
    }

    logHomeDashboardFetch(payload)

    if (payload) {
      writeGrowthHomeExecutiveSessionCache(payload)
      const applied = applyWorkspaceSummaryPayload(payload)
      setDashboard(applied.dashboard)
      setWorkspaceSummary(applied.workspaceSummary)
      setAvaConsole(applied.avaConsole)
      setError(null)
    } else {
      setError(errorMessage)
      const cached = readGrowthHomeExecutiveSessionCache()
      const preserved = workspaceSummaryRef.current ?? cached
      if (preserved) {
        const applied = applyWorkspaceSummaryPayload(preserved)
        setDashboard(applied.dashboard)
        setWorkspaceSummary(applied.workspaceSummary)
        setAvaConsole(applied.avaConsole)
      }
      // First load without confirmed server payload: do not synthesize an empty dashboard (false Idle).
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    dashboard,
    workspaceSummary,
    avaConsole,
    loading,
    refreshing,
    error,
    reload,
    fetchBatchMarker: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    debugSourcePath: GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  }
}
