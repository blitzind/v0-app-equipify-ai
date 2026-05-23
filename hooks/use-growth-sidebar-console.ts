"use client"

import { useCallback, useEffect, useState } from "react"

const TERMINAL_LEAD_STATUSES = new Set(["converted", "disqualified", "archived"])

export type GrowthSidebarPreviewLine = {
  label: string
  value: number | string
}

export type GrowthSidebarConsoleState = {
  loading: boolean
  badges: Partial<Record<GrowthSidebarConsoleKey, number>>
  previews: Partial<Record<GrowthSidebarConsoleKey, GrowthSidebarPreviewLine[]>>
  health: {
    revenueRisk: number
    executiveNow: number
    capacityLabel: string
  }
}

export type GrowthSidebarConsoleKey =
  | "inbox"
  | "callQueue"
  | "imports"
  | "engagement"
  | "relationships"
  | "opportunities"
  | "revenue"
  | "executive"
  | "capacity"
  | "copilot"
  | "playbooks"
  | "outreach"
  | "providers"

const EMPTY_STATE: GrowthSidebarConsoleState = {
  loading: true,
  badges: {},
  previews: {},
  health: {
    revenueRisk: 0,
    executiveNow: 0,
    capacityLabel: "Healthy",
  },
}

function capacityHealthLabel(tierCounts: {
  healthy?: number
  strained?: number
  constrained?: number
  critical?: number
}): string {
  if ((tierCounts.critical ?? 0) > 0) return "Critical"
  if ((tierCounts.constrained ?? 0) > 0) return "Constrained"
  if ((tierCounts.strained ?? 0) > 0) return "Strained"
  return "Healthy"
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean }
    if (!res.ok || data.ok === false) return null
    return data
  } catch {
    return null
  }
}

export function useGrowthSidebarConsole(): GrowthSidebarConsoleState {
  const [state, setState] = useState<GrowthSidebarConsoleState>(EMPTY_STATE)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    const [
      leadsRes,
      callQueueRes,
      copilotRes,
      revenueRes,
      executiveRes,
      capacityRes,
      playbooksRes,
      engagementRes,
      relationshipsRes,
      opportunitiesRes,
    ] = await Promise.all([
      fetchJson<{ ok?: boolean; leads?: Array<{ status: string }> }>("/api/platform/growth/leads"),
      fetchJson<{ ok?: boolean; rows?: unknown[] }>(
        "/api/platform/growth/call-queue?filter=call_ready&limit=100",
      ),
      fetchJson<{ ok?: boolean; dashboard?: { approvalQueue?: unknown[] } }>(
        "/api/platform/growth/copilot/dashboard",
      ),
      fetchJson<{
        ok?: boolean
        dashboard?: {
          tierCounts?: Record<string, number>
          trajectoryCounts?: Record<string, number>
          revenueRegressionWatch?: unknown[]
          highAttention?: unknown[]
        }
      }>("/api/platform/growth/revenue/dashboard"),
      fetchJson<{
        ok?: boolean
        dashboard?: {
          tierCounts?: Record<string, number>
          executiveNow?: unknown[]
          revenueRisk?: unknown[]
          leadershipBottlenecks?: unknown[]
        }
      }>("/api/platform/growth/executive/dashboard"),
      fetchJson<{
        ok?: boolean
        dashboard?: {
          tierCounts?: Record<string, number>
          operationalRisk?: unknown[]
          capacityAtRisk?: unknown[]
        }
      }>("/api/platform/growth/capacity/dashboard"),
      fetchJson<{ ok?: boolean; draftRules?: unknown[] }>("/api/platform/growth/copilot/playbooks"),
      fetchJson<{
        ok?: boolean
        dashboard?: {
          hotLeads?: unknown[]
          engagedLeads?: unknown[]
          needsAttention?: unknown[]
        }
      }>("/api/platform/growth/engagement/dashboard"),
      fetchJson<{
        ok?: boolean
        dashboard?: {
          trustedRelationships?: unknown[]
          strategicRelationships?: unknown[]
          relationshipCooling?: unknown[]
        }
      }>("/api/platform/growth/relationships/dashboard"),
      fetchJson<{
        ok?: boolean
        dashboard?: {
          priorityOpportunities?: unknown[]
          salesReady?: unknown[]
          blockedOpportunities?: unknown[]
        }
      }>("/api/platform/growth/opportunities/dashboard"),
    ])

    const activeLeads = (leadsRes?.leads ?? []).filter((lead) => !TERMINAL_LEAD_STATUSES.has(lead.status))
    const callQueueCount = callQueueRes?.rows?.length ?? 0
    const approvalQueueCount = copilotRes?.dashboard?.approvalQueue?.length ?? 0
    const revenue = revenueRes?.dashboard
    const executive = executiveRes?.dashboard
    const capacity = capacityRes?.dashboard
    const playbooksDraftCount = playbooksRes?.draftRules?.length ?? 0
    const engagement = engagementRes?.dashboard
    const relationships = relationshipsRes?.dashboard
    const opportunities = opportunitiesRes?.dashboard

    const revenueTier = revenue?.tierCounts ?? {}
    const revenueTrajectory = revenue?.trajectoryCounts ?? {}
    const executiveTier = executive?.tierCounts ?? {}
    const capacityTier = capacity?.tierCounts ?? {}

    const revenueAttention =
      (revenueTier.forecasted ?? 0) + (revenueTier.commit_candidate ?? 0)
    const regressionCount =
      (revenueTrajectory.at_risk ?? 0) + (revenueTrajectory.slowing ?? 0)

    setState({
      loading: false,
      badges: {
        inbox: activeLeads.length,
        callQueue: callQueueCount,
        copilot: approvalQueueCount,
        revenue: revenueAttention > 0 ? revenueAttention : undefined,
        executive: executiveTier.executive_now ?? undefined,
        playbooks: playbooksDraftCount > 0 ? playbooksDraftCount : undefined,
        engagement: engagement?.hotLeads?.length ?? undefined,
        opportunities: opportunities?.priorityOpportunities?.length ?? undefined,
      },
      previews: {
        revenue: [
          { label: "Forecasted", value: revenueTier.forecasted ?? 0 },
          { label: "Commit", value: revenueTier.commit_candidate ?? 0 },
          { label: "Regression", value: regressionCount },
        ],
        executive: [
          { label: "Executive now", value: executiveTier.executive_now ?? 0 },
          { label: "Priority", value: executiveTier.priority ?? 0 },
          { label: "Revenue risk", value: executive?.revenueRisk?.length ?? 0 },
        ],
        engagement: [
          { label: "Hot", value: engagement?.hotLeads?.length ?? 0 },
          { label: "Engaged", value: engagement?.engagedLeads?.length ?? 0 },
          { label: "Needs attention", value: engagement?.needsAttention?.length ?? 0 },
        ],
        capacity: [
          { label: "Healthy", value: capacityTier.healthy ?? 0 },
          { label: "Strained", value: capacityTier.strained ?? 0 },
          { label: "At risk", value: capacity?.capacityAtRisk?.length ?? 0 },
        ],
        copilot: [{ label: "Approval queue", value: approvalQueueCount }],
        callQueue: [{ label: "Call ready", value: callQueueCount }],
        inbox: [{ label: "Active leads", value: activeLeads.length }],
        relationships: [
          { label: "Trusted", value: relationships?.trustedRelationships?.length ?? 0 },
          { label: "Strategic", value: relationships?.strategicRelationships?.length ?? 0 },
          { label: "Cooling", value: relationships?.relationshipCooling?.length ?? 0 },
        ],
        opportunities: [
          { label: "Priority", value: opportunities?.priorityOpportunities?.length ?? 0 },
          { label: "Sales ready", value: opportunities?.salesReady?.length ?? 0 },
          { label: "Blocked", value: opportunities?.blockedOpportunities?.length ?? 0 },
        ],
        playbooks: [{ label: "Draft rules", value: playbooksDraftCount }],
      },
      health: {
        revenueRisk: regressionCount,
        executiveNow: executiveTier.executive_now ?? 0,
        capacityLabel: capacityHealthLabel(capacityTier),
      },
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return state
}

export const GROWTH_SIDEBAR_COLLAPSED_STORAGE_KEY = "equipify-growth-sidebar-collapsed"
