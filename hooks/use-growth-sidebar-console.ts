"use client"

import { useCallback, useEffect, useState } from "react"

export type GrowthSidebarPreviewLine = {
  label: string
  value: number | string
}

export type GrowthSidebarConsoleHealth = {
  openInbox: number
  pendingApproval: number
  activeSequences: number
  criticalSignals: number
  systemHealthLabel: string
}

export type GrowthSidebarConsoleState = {
  loading: boolean
  degraded: boolean
  badges: Partial<Record<GrowthSidebarConsoleKey, number>>
  previews: Partial<Record<GrowthSidebarConsoleKey, GrowthSidebarPreviewLine[]>>
  health: GrowthSidebarConsoleHealth
}

export type GrowthSidebarConsoleKey =
  | "command"
  | "inbox"
  | "inbox_high_priority"
  | "callQueue"
  | "imports"
  | "intent_pixel"
  | "engagement"
  | "relationships"
  | "opportunities"
  | "revenue"
  | "executive"
  | "capacity"
  | "copilot"
  | "playbooks"
  | "calls"
  | "calls_providers"
  | "calls_live"
  | "calls_live_coaching"
  | "calls_workspace"
  | "outreach"
  | "outreach_approval"
  | "providers"
  | "conversations"
  | "sequences"
  | "sequence_execution"
  | "operator_notifications"

const DEFAULT_HEALTH: GrowthSidebarConsoleHealth = {
  openInbox: 0,
  pendingApproval: 0,
  activeSequences: 0,
  criticalSignals: 0,
  systemHealthLabel: "Healthy",
}

const EMPTY_STATE: GrowthSidebarConsoleState = {
  loading: true,
  degraded: false,
  badges: {},
  previews: {},
  health: DEFAULT_HEALTH,
}

function logGrowthSidebarDev(event: string): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[GrowthSidebar] ${event}`)
  }
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

function systemHealthLabel(input: {
  capacityTier: Parameters<typeof capacityHealthLabel>[0]
  commandCritical: number
  outreachPending: number
}): string {
  const capacityLabel = capacityHealthLabel(input.capacityTier)
  if (capacityLabel === "Critical" || input.commandCritical >= 5) return "Critical"
  if (capacityLabel === "Constrained" || capacityLabel === "Strained" || input.outreachPending >= 10) return "Attention"
  if (input.commandCritical > 0 || input.outreachPending > 0) return "Monitor"
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

function safeLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

export function useGrowthSidebarConsole(): GrowthSidebarConsoleState {
  const [state, setState] = useState<GrowthSidebarConsoleState>(EMPTY_STATE)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, degraded: false }))

    try {
      const [
        commandRes,
        leadInboxRes,
        callQueueRes,
        copilotRes,
        cutoverStatusRes,
        outreachApprovalRes,
        sequenceExecutionRes,
        intentPixelRes,
        revenueRes,
        executiveRes,
        capacityRes,
        playbooksRes,
        callsRes,
        callsLiveRes,
        liveCoachingRes,
        engagementRes,
        relationshipsRes,
        opportunitiesRes,
        unifiedInboxRes,
        sequencesRes,
        patternEnrollmentStatsRes,
        operatorNotificationsRes,
      ] = await Promise.all([
        fetchJson<{ ok?: boolean; dashboard?: { missionControl?: { criticalActions?: number } } }>(
          "/api/platform/growth/command/dashboard",
        ),
        fetchJson<{
          ok?: boolean
          total?: number
          sections?: Array<{ id: string; items?: unknown[] }>
        }>("/api/platform/growth/lead-inbox"),
        fetchJson<{ ok?: boolean; rows?: unknown[] }>(
          "/api/platform/growth/call-queue?filter=call_ready&limit=100",
        ),
        fetchJson<{ ok?: boolean; dashboard?: { approvalQueue?: unknown[] } }>(
          "/api/platform/growth/copilot/dashboard",
        ),
        fetchJson<{ ok?: boolean; cutover?: { adapter_execution_enabled?: boolean } }>(
          "/api/platform/growth/outbound/cutover-status",
        ),
        fetchJson<{ ok?: boolean; sections?: { pendingApproval?: unknown[] } }>(
          "/api/platform/growth/outreach/approval-dashboard",
        ),
        fetchJson<{ ok?: boolean; dashboard?: { pendingApproval?: number } }>(
          "/api/platform/growth/sequences/execution/dashboard",
        ),
        fetchJson<{
          ok?: boolean
          snapshot?: {
            live_visitors?: unknown[]
            high_intent_queue?: unknown[]
          }
        }>("/api/platform/growth/intent-pixel/monitor?site_key=equipify-sandbox"),
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
        fetchJson<{ ok?: boolean; dashboard?: { stats?: { activeCount?: number; highRiskActive?: number } } }>(
          "/api/platform/growth/calls/dashboard",
        ),
        fetchJson<{ ok?: boolean; dashboard?: { stats?: { liveCount?: number } } }>(
          "/api/platform/growth/calls/live/dashboard",
        ),
        fetchJson<{ ok?: boolean; dashboard?: { stats?: { activeGuidanceEvents?: number } } }>(
          "/api/platform/growth/calls/live-coaching/dashboard",
        ),
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
        fetchJson<{
          ok?: boolean
          dashboard?: { open_count?: number; critical_priority_count?: number; needs_review_count?: number }
        }>("/api/platform/growth/inbox/dashboard"),
        fetchJson<{
          ok?: boolean
          dashboard?: { active_count?: number }
          pattern_stats?: { activeCount?: number }
        }>("/api/platform/growth/sequences/dashboard"),
        fetchJson<{
          ok?: boolean
          stats?: { activeCount?: number }
        }>("/api/platform/growth/sequences/enrollments/stats"),
        fetchJson<{
          ok?: boolean
          counts?: { unreadTotal?: number }
        }>("/api/platform/growth/notifications/unread"),
      ])

      const inboxTotal = leadInboxRes?.total ?? 0
      const highPrioritySection = leadInboxRes?.sections?.find((s) => s.id === "high_priority")
      const highPriorityCount = safeLength(highPrioritySection?.items)
      const commandCritical = commandRes?.dashboard?.missionControl?.criticalActions ?? 0
      const callQueueCount = safeLength(callQueueRes?.rows)
      const approvalQueueCount = safeLength(copilotRes?.dashboard?.approvalQueue)
      const adapterRollbackActive = Boolean(cutoverStatusRes?.cutover?.adapter_execution_enabled)
      const legacyOutreachPending = safeLength(outreachApprovalRes?.sections?.pendingApproval)
      const sequencePendingCount = sequenceExecutionRes?.dashboard?.pendingApproval ?? 0
      const outreachPendingCount = adapterRollbackActive
        ? legacyOutreachPending + sequencePendingCount
        : sequencePendingCount
      const intentHighIntentCount = safeLength(intentPixelRes?.snapshot?.high_intent_queue)
      const intentLiveCount = safeLength(intentPixelRes?.snapshot?.live_visitors)
      const intentPixelBadge =
        intentHighIntentCount > 0 ? intentHighIntentCount : intentLiveCount > 0 ? intentLiveCount : undefined
      const revenue = revenueRes?.dashboard
      const executive = executiveRes?.dashboard
      const capacity = capacityRes?.dashboard
      const playbooksDraftCount = safeLength(playbooksRes?.draftRules)
      const calls = callsRes?.dashboard
      const callsLiveCount = callsLiveRes?.dashboard?.stats?.liveCount ?? 0
      const liveCoachingActive = liveCoachingRes?.dashboard?.stats?.activeGuidanceEvents ?? 0
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

      const unifiedInbox = unifiedInboxRes?.dashboard
      const openInboxCount = unifiedInbox?.open_count ?? 0
      const inboxCriticalCount = unifiedInbox?.critical_priority_count ?? 0
      const templateActiveCount = sequencesRes?.dashboard?.active_count ?? 0
      const patternActiveCount =
        patternEnrollmentStatsRes?.stats?.activeCount ??
        sequencesRes?.pattern_stats?.activeCount ??
        0
      const activeSequencesCount = patternActiveCount > 0 ? patternActiveCount : templateActiveCount
      const criticalSignalsCount = commandCritical + intentHighIntentCount + inboxCriticalCount
      const operatorNotificationUnread = operatorNotificationsRes?.counts?.unreadTotal ?? 0

      setState({
        loading: false,
        degraded: false,
        badges: {
          command: commandCritical > 0 ? commandCritical : undefined,
          operator_notifications:
            operatorNotificationUnread > 0 ? operatorNotificationUnread : undefined,
          inbox: inboxTotal > 0 ? inboxTotal : undefined,
          inbox_high_priority: highPriorityCount > 0 ? highPriorityCount : undefined,
          intent_pixel: intentPixelBadge,
          callQueue: callQueueCount > 0 ? callQueueCount : undefined,
          copilot: approvalQueueCount > 0 ? approvalQueueCount : undefined,
          outreach_approval: outreachPendingCount > 0 ? outreachPendingCount : undefined,
          sequence_execution: sequencePendingCount > 0 ? sequencePendingCount : undefined,
          revenue: revenueAttention > 0 ? revenueAttention : undefined,
          executive: executiveTier.executive_now ?? undefined,
          playbooks: playbooksDraftCount > 0 ? playbooksDraftCount : undefined,
          calls: calls?.stats?.activeCount ? calls.stats.activeCount : undefined,
          calls_live: callsLiveCount > 0 ? callsLiveCount : undefined,
          calls_live_coaching: liveCoachingActive > 0 ? liveCoachingActive : undefined,
          engagement: safeLength(engagement?.hotLeads) || undefined,
          opportunities: safeLength(opportunities?.priorityOpportunities) || undefined,
          sequences: activeSequencesCount > 0 ? activeSequencesCount : undefined,
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
            { label: "Revenue risk", value: safeLength(executive?.revenueRisk) },
          ],
          engagement: [
            { label: "Hot", value: safeLength(engagement?.hotLeads) },
            { label: "Engaged", value: safeLength(engagement?.engagedLeads) },
            { label: "Needs attention", value: safeLength(engagement?.needsAttention) },
          ],
          capacity: [
            { label: "Healthy", value: capacityTier.healthy ?? 0 },
            { label: "Strained", value: capacityTier.strained ?? 0 },
            { label: "At risk", value: safeLength(capacity?.capacityAtRisk) },
          ],
          copilot: [{ label: "Approval queue", value: approvalQueueCount }],
          callQueue: [{ label: "Call ready", value: callQueueCount }],
          command: [{ label: "Critical actions", value: commandCritical }],
          inbox: [
            { label: "Inbox total", value: inboxTotal },
            { label: "High priority", value: highPriorityCount },
          ],
          intent_pixel: [
            { label: "High intent queue", value: intentHighIntentCount },
            { label: "Live visitors", value: intentLiveCount },
          ],
          outreach_approval: [
            {
              label: adapterRollbackActive ? "Pending approval" : "Sequence pending",
              value: outreachPendingCount,
            },
          ],
          sequence_execution: [{ label: "Sequence pending", value: sequencePendingCount }],
          relationships: [
            { label: "Trusted", value: safeLength(relationships?.trustedRelationships) },
            { label: "Strategic", value: safeLength(relationships?.strategicRelationships) },
            { label: "Cooling", value: safeLength(relationships?.relationshipCooling) },
          ],
          opportunities: [
            { label: "Priority", value: safeLength(opportunities?.priorityOpportunities) },
            { label: "Sales ready", value: safeLength(opportunities?.salesReady) },
            { label: "Blocked", value: safeLength(opportunities?.blockedOpportunities) },
          ],
          playbooks: [{ label: "Draft rules", value: playbooksDraftCount }],
          calls: [
            { label: "Active", value: calls?.stats?.activeCount ?? 0 },
            { label: "High risk", value: calls?.stats?.highRiskActive ?? 0 },
          ],
        },
        health: {
          openInbox: openInboxCount,
          pendingApproval: outreachPendingCount,
          activeSequences: activeSequencesCount,
          criticalSignals: criticalSignalsCount,
          systemHealthLabel: systemHealthLabel({
            capacityTier,
            commandCritical,
            outreachPending: outreachPendingCount,
          }),
        },
      })
    } catch {
      logGrowthSidebarDev("GrowthSidebarConsole failed")
      setState({
        loading: false,
        degraded: true,
        badges: {},
        previews: {},
        health: DEFAULT_HEALTH,
      })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return state
}

export const GROWTH_SIDEBAR_COLLAPSED_STORAGE_KEY = "equipify-growth-sidebar-collapsed"
