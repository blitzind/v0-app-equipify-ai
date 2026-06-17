"use client"

import { useCallback, useEffect, useState } from "react"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"
import type { GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

const WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER = "growth-workspace-dashboard-fetch-batch-v1" as const

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as T
    if (!res.ok) return null
    return data
  } catch {
    return null
  }
}

/** Single batched load — one Promise.all, no duplicate endpoint fetches. */
export async function loadGrowthWorkspaceDashboardSources(): Promise<GrowthWorkspaceDashboardSourcePayload> {
  const [
    briefingPayload,
    leadInboxPayload,
    cadencePayload,
    pipelinePayload,
    opportunityPayload,
    sequencePayload,
    executionPayload,
    engagementPayload,
    conversationPayload,
    relationshipPayload,
    callsPayload,
  ] = await Promise.all([
    fetchJson<{ ok?: boolean; briefing?: AidenDailyBriefing }>("/api/platform/growth/aiden/briefing"),
    fetchJson<{ ok?: boolean; sections?: GrowthWorkspaceDashboardSourcePayload["leadInboxSections"] }>(
      "/api/platform/growth/lead-inbox?sort=priority",
    ),
    fetchJson<{ ok?: boolean; summary?: GrowthCadenceCommandSummary | null }>(
      "/api/platform/growth/cadence/command-summary",
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthOpportunityPipelineDashboard | null }>(
      "/api/platform/growth/opportunities/pipeline?view=all_pipeline&limit=1",
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["opportunityReadiness"] }>(
      "/api/platform/growth/opportunities/dashboard",
    ),
    fetchJson<{
      ok?: boolean
      dashboard?: { active_count?: number }
      templates?: Array<{ status?: string }>
      enrollments?: unknown[]
    }>("/api/platform/growth/sequences/dashboard"),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["sequenceExecution"] }>(
      "/api/platform/growth/sequences/execution/dashboard",
    ),
    fetchJson<{ ok?: boolean; workspace?: GrowthWorkspaceDashboardSourcePayload["engagementWorkspace"] }>(
      "/api/platform/growth/engagement-dashboard/command-center?dateRange=last_7_days&limit=1",
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["conversationDashboard"] }>(
      "/api/platform/growth/conversations/dashboard",
    ),
    fetchJson<{ ok?: boolean; dashboard?: GrowthWorkspaceDashboardSourcePayload["relationshipDashboard"] }>(
      "/api/platform/growth/relationships/dashboard",
    ),
    fetchJson<{ ok?: boolean; workspaceDashboard?: { stats?: { callsToday?: number } } | null }>(
      "/api/platform/growth/calls/dashboard",
    ),
  ])

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
    fetchBatchMarker: WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
  }
}
