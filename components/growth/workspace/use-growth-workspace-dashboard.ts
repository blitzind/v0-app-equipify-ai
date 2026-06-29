"use client"

import { useCallback, useEffect, useState } from "react"
import type { DailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import type { DailyRevenueWorkQueueDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"
import {
  GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  GROWTH_HOME_WORKSPACE_API_ROUTES,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
} from "@/lib/growth/home/growth-home-workspace-api-contract"
import type { GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

async function fetchJson<T>(url: string): Promise<{ data: T | null; cacheControl: string | null }> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as T
    if (!res.ok) return { data: null, cacheControl: res.headers.get("cache-control") }
    return { data, cacheControl: res.headers.get("cache-control") }
  } catch {
    return { data: null, cacheControl: null }
  }
}

/** Single batched load — one Promise.all, no duplicate endpoint fetches. */
export async function loadGrowthWorkspaceDashboardSources(): Promise<GrowthWorkspaceDashboardSourcePayload> {
  const [
    briefingResult,
    leadInboxResult,
    cadenceResult,
    pipelineResult,
    opportunityResult,
    sequenceResult,
    executionResult,
    engagementResult,
    conversationResult,
    relationshipResult,
    callsResult,
    dailyQueueResult,
  ] = await Promise.all([
    fetchJson<{ ok?: boolean; briefing?: AidenDailyBriefing }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "aiden_briefing")!.path,
    ),
    fetchJson<{ ok?: boolean; sections?: GrowthWorkspaceDashboardSourcePayload["leadInboxSections"] }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "lead_inbox")!.path,
    ),
    fetchJson<{ ok?: boolean; summary?: GrowthCadenceCommandSummary | null }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "cadence_command_summary")!.path,
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthOpportunityPipelineDashboard | null }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "opportunities_pipeline")!.path,
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["opportunityReadiness"] }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "opportunities_dashboard")!.path,
    ),
    fetchJson<{
      ok?: boolean
      dashboard?: { active_count?: number }
      templates?: Array<{ status?: string }>
      enrollments?: unknown[]
    }>(GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "sequences_dashboard")!.path),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["sequenceExecution"] }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "sequence_execution_dashboard")!.path,
    ),
    fetchJson<{ ok?: boolean; workspace?: GrowthWorkspaceDashboardSourcePayload["engagementWorkspace"] }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "engagement_command_center")!.path,
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["conversationDashboard"] }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "conversations_dashboard")!.path,
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["relationshipDashboard"] }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "relationships_dashboard")!.path,
    ),
    fetchJson<{ ok?: boolean; workspaceDashboard?: { stats?: { callsToday?: number } } | null }>(
      GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "calls_dashboard")!.path,
    ),
    fetchJson<{
      ok?: boolean
      enabled?: boolean
      queue?: DailyRevenueWorkQueue | null
      display?: DailyRevenueWorkQueueDisplaySummary | null
    }>(GROWTH_HOME_WORKSPACE_API_ROUTES.find((route) => route.id === "daily_revenue_work_queue")!.path),
  ])

  const briefingPayload = briefingResult.data
  const leadInboxPayload = leadInboxResult.data
  const cadencePayload = cadenceResult.data
  const pipelinePayload = pipelineResult.data
  const opportunityPayload = opportunityResult.data
  const sequencePayload = sequenceResult.data
  const executionPayload = executionResult.data
  const engagementPayload = engagementResult.data
  const conversationPayload = conversationResult.data
  const relationshipPayload = relationshipResult.data
  const callsPayload = callsResult.data
  const dailyQueuePayload = dailyQueueResult.data

  if (typeof window !== "undefined") {
    console.info("[growth/home/dashboard-fetch]", {
      batch: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
      fetched_at: new Date().toISOString(),
      cache_headers: Object.fromEntries(
        GROWTH_HOME_WORKSPACE_API_ROUTES.map((route, index) => {
          const results = [
            briefingResult,
            leadInboxResult,
            cadenceResult,
            pipelineResult,
            opportunityResult,
            sequenceResult,
            executionResult,
            engagementResult,
            conversationResult,
            relationshipResult,
            callsResult,
            dailyQueueResult,
          ]
          return [route.id, results[index]?.cacheControl ?? null]
        }),
      ),
    })
  }

  return {
    briefing: briefingPayload?.ok && briefingPayload.briefing ? briefingPayload.briefing : null,
    leadInboxSections: leadInboxPayload?.ok && leadInboxPayload.sections ? leadInboxPayload.sections : [],
    cadenceSummary: cadencePayload?.ok ? (cadencePayload.summary ?? null) : null,
    pipelineDashboard: pipelinePayload?.ok ? (pipelinePayload.dashboard ?? null) : null,
    opportunityReadiness: opportunityPayload?.ok ? (opportunityPayload.dashboard ?? null) : null,
    sequenceFoundation: sequencePayload?.ok ? sequencePayload : null,
    sequenceExecution: executionPayload?.ok ? (executionPayload.dashboard ?? null) : null,
    engagementWorkspace: engagementPayload?.ok ? (engagementPayload.workspace ?? null) : null,
    conversationDashboard: conversationPayload?.ok ? (conversationPayload.dashboard ?? null) : null,
    relationshipDashboard: relationshipPayload?.ok ? (relationshipPayload.dashboard ?? null) : null,
    callsDashboard: callsPayload?.ok ? { workspaceDashboard: callsPayload.workspaceDashboard ?? null } : null,
    dailyRevenueWorkQueueEnabled: dailyQueuePayload?.ok === true && dailyQueuePayload.enabled === true,
    dailyRevenueWorkQueue:
      dailyQueuePayload?.ok && dailyQueuePayload.enabled ? (dailyQueuePayload.queue ?? null) : null,
    dailyRevenueWorkQueueDisplay:
      dailyQueuePayload?.ok && dailyQueuePayload.enabled ? (dailyQueuePayload.display ?? null) : null,
  }
}

export function useGrowthWorkspaceDashboard() {
  const [dashboard, setDashboard] = useState<GrowthWorkspaceDashboardViewModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sources = await loadGrowthWorkspaceDashboardSources()
      setDashboard(buildGrowthWorkspaceDashboardViewModel(sources))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load workspace dashboard.")
      setDashboard(buildGrowthWorkspaceDashboardViewModel({
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
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    dashboard,
    loading,
    error,
    reload,
    fetchBatchMarker: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    debugSourcePath: GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  }
}
