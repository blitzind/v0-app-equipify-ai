"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { GrowthBookingRecommendation } from "@/lib/growth/booking-intelligence/booking-types"
import type { GrowthLeadMemoryProfileView } from "@/lib/growth/lead-memory/memory-types"
import type { GrowthOpportunityRecommendation } from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type {
  GrowthConversationTimelineEntry,
  GrowthReplyCopilotAssist,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import type {
  GrowthReplyWorkflowActionRecord,
  GrowthSequenceExitCandidateRecord,
} from "@/lib/growth/reply-intelligence/workflow-actions-types"
import type {
  GrowthRevenueCommandCenterLead,
  GrowthRevenueForecastEvidence,
  GrowthRevenuePlaybook,
  GrowthSalesExecutionPlan,
} from "@/lib/growth/revenue-execution/revenue-execution-types"
import type { GrowthRevenueReadinessSnapshot } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import {
  readExecutionPlanFromLeadMetadata,
  readRevenueReadinessForLead,
  resolveInboxRevenuePlaybook,
} from "@/lib/growth/inbox/inbox-revenue-context"
import { useGrowthInboxSharedData } from "@/components/growth/inbox/growth-inbox-shared-data-provider"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"
import { scheduleGrowthInboxIdleTask } from "@/lib/growth/inbox/inbox-load-scheduler"

type GrowthInboxLeadContextValue = {
  leadId: string | null
  threadId: string | null
  thread: GrowthInboxThread | null
  loading: boolean
  error: string | null
  memoryProfile: GrowthLeadMemoryProfileView | null
  timeline: GrowthConversationTimelineEntry[]
  copilot: GrowthReplyCopilotAssist | null
  lead: GrowthLead | null
  workflowActions: GrowthReplyWorkflowActionRecord[]
  sequenceExitCandidates: GrowthSequenceExitCandidateRecord[]
  opportunityRecommendations: GrowthOpportunityRecommendation[]
  bookingRecommendations: GrowthBookingRecommendation[]
  revenueReadiness: GrowthRevenueReadinessSnapshot | null
  forecastEvidence: GrowthRevenueForecastEvidence | null
  executionPlan: GrowthSalesExecutionPlan | null
  playbook: GrowthRevenuePlaybook | null
  commandCenterLead: GrowthRevenueCommandCenterLead | null
  refresh: () => Promise<void>
  refreshWorkflow: () => Promise<void>
  refreshRecommendations: () => Promise<void>
}

const GrowthInboxLeadContext = createContext<GrowthInboxLeadContextValue | null>(null)

export function useGrowthInboxLeadContext(): GrowthInboxLeadContextValue {
  const value = useContext(GrowthInboxLeadContext)
  if (!value) {
    throw new Error("useGrowthInboxLeadContext must be used within GrowthInboxLeadContextProvider")
  }
  return value
}

function filterRecommendationsForThread<T extends { inboxThreadId?: string | null }>(
  items: T[],
  threadId: string | null,
): T[] {
  return items.filter((item) => !item.inboxThreadId || !threadId || item.inboxThreadId === threadId)
}

export function GrowthInboxLeadContextProvider({
  leadId,
  threadId,
  thread,
  children,
}: {
  leadId: string | null
  threadId: string | null
  thread: GrowthInboxThread | null
  children: ReactNode
}) {
  const { getCommandCenterLead } = useGrowthInboxSharedData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoryProfile, setMemoryProfile] = useState<GrowthLeadMemoryProfileView | null>(null)
  const [timeline, setTimeline] = useState<GrowthConversationTimelineEntry[]>([])
  const [copilot, setCopilot] = useState<GrowthReplyCopilotAssist | null>(null)
  const [lead, setLead] = useState<GrowthLead | null>(null)
  const [workflowActions, setWorkflowActions] = useState<GrowthReplyWorkflowActionRecord[]>([])
  const [sequenceExitCandidates, setSequenceExitCandidates] = useState<GrowthSequenceExitCandidateRecord[]>([])
  const [opportunityRecommendations, setOpportunityRecommendations] = useState<GrowthOpportunityRecommendation[]>([])
  const [bookingRecommendations, setBookingRecommendations] = useState<GrowthBookingRecommendation[]>([])
  const [forecastEvidence, setForecastEvidence] = useState<GrowthRevenueForecastEvidence | null>(null)
  const [executionPlan, setExecutionPlan] = useState<GrowthSalesExecutionPlan | null>(null)

  const revenueReadiness = useMemo(() => readRevenueReadinessForLead(lead), [lead])

  const commandCenterLead = useMemo(
    () => (leadId ? getCommandCenterLead(leadId) : null),
    [leadId, getCommandCenterLead],
  )

  const playbook = useMemo(
    () =>
      resolveInboxRevenuePlaybook({
        lead,
        thread,
        memoryProfile,
        recommendationTypes: opportunityRecommendations.map((entry) => entry.recommendationType),
      }),
    [lead, thread, memoryProfile, opportunityRecommendations],
  )

  const clearLeadState = useCallback(() => {
    setMemoryProfile(null)
    setTimeline([])
    setCopilot(null)
    setLead(null)
    setWorkflowActions([])
    setSequenceExitCandidates([])
    setOpportunityRecommendations([])
    setBookingRecommendations([])
    setForecastEvidence(null)
    setExecutionPlan(null)
    setError(null)
  }, [])

  const refreshWorkflow = useCallback(async () => {
    if (!leadId) {
      setWorkflowActions([])
      setSequenceExitCandidates([])
      return
    }

    const workflowParams = new URLSearchParams({ status: "pending_review", limit: "20", leadId })
    const exitParams = new URLSearchParams({ pendingOnly: "true", limit: "20", leadId })

    const [workflowRes, exitRes] = await Promise.all([
      fetchPlatformGrowthClient(`/api/platform/growth/replies/workflow-actions?${workflowParams.toString()}`, {
        cache: "no-store",
      }),
      fetchPlatformGrowthClient(`/api/platform/growth/replies/sequence-exit-candidates?${exitParams.toString()}`, {
        cache: "no-store",
      }),
    ])

    const workflowPayload = (await workflowRes.json()) as { items?: GrowthReplyWorkflowActionRecord[] }
    const exitPayload = (await exitRes.json()) as { items?: GrowthSequenceExitCandidateRecord[] }

    if (workflowRes.ok) setWorkflowActions(workflowPayload.items ?? [])
    else setWorkflowActions([])

    if (exitRes.ok) setSequenceExitCandidates(exitPayload.items ?? [])
    else setSequenceExitCandidates([])
  }, [leadId])

  const refreshRecommendations = useCallback(async () => {
    if (!leadId) {
      setOpportunityRecommendations([])
      setBookingRecommendations([])
      return
    }

    const encodedLeadId = encodeURIComponent(leadId)
    const bookingParams = new URLSearchParams({ leadId, status: "pending_review" })

    const [opportunityDashboardRes, bookingRes] = await Promise.all([
      fetchPlatformGrowthClient(`/api/platform/growth/opportunities/dashboard?leadId=${encodedLeadId}`, {
        cache: "no-store",
      }),
      fetchPlatformGrowthClient(`/api/platform/growth/booking-intelligence/recommendations?${bookingParams.toString()}`, {
        cache: "no-store",
      }),
    ])

    const opportunityDashboardPayload = (await opportunityDashboardRes.json()) as {
      intelligence?: { recommendedActions?: GrowthOpportunityRecommendation[] }
    }
    const bookingPayload = (await bookingRes.json()) as { recommendations?: GrowthBookingRecommendation[] }

    const recommendations = filterRecommendationsForThread(
      opportunityDashboardPayload.intelligence?.recommendedActions ?? [],
      threadId,
    )
    setOpportunityRecommendations(recommendations)

    const bookings = filterRecommendationsForThread(bookingPayload.recommendations ?? [], threadId)
    setBookingRecommendations(bookings)
  }, [leadId, threadId])

  const refreshConversationCore = useCallback(async (): Promise<GrowthLead | null> => {
    if (!leadId) {
      clearLeadState()
      return null
    }

    setLoading(true)
    setError(null)
    try {
      const encodedLeadId = encodeURIComponent(leadId)
      const [timelineRes, leadRes] = await Promise.all([
        fetchPlatformGrowthClient(`/api/platform/growth/replies/timeline?leadId=${encodedLeadId}`, { cache: "no-store" }),
        fetchPlatformGrowthClient(`/api/platform/growth/leads/${encodedLeadId}`, { cache: "no-store" }),
      ])

      const timelinePayload = (await timelineRes.json()) as { timeline?: { entries?: GrowthConversationTimelineEntry[] } }
      const leadPayload = (await leadRes.json()) as { lead?: GrowthLead }
      const loadedLead = leadRes.ok && leadPayload.lead ? leadPayload.lead : null

      if (timelineRes.ok) setTimeline(timelinePayload.timeline?.entries ?? [])
      else setTimeline([])

      if (loadedLead) setLead(loadedLead)
      else setLead(null)

      return loadedLead
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load lead context.")
      return null
    } finally {
      setLoading(false)
    }
  }, [leadId, clearLeadState])

  const refreshLeadEnrichment = useCallback(async (leadFallback?: GrowthLead | null) => {
    if (!leadId) return

    const encodedLeadId = encodeURIComponent(leadId)
    const [memoryRes, copilotRes, forecastRes, executionPlanRes] = await Promise.all([
      fetchPlatformGrowthClient(`/api/platform/growth/lead-memory/profile/${encodedLeadId}`, { cache: "no-store" }),
      fetchPlatformGrowthClient(`/api/platform/growth/replies/copilot?leadId=${encodedLeadId}`, { cache: "no-store" }),
      fetchPlatformGrowthClient(`/api/platform/growth/revenue-execution/forecast-evidence?leadId=${encodedLeadId}`, {
        cache: "no-store",
      }),
      fetchPlatformGrowthClient(`/api/platform/growth/revenue-execution/execution-plan?leadId=${encodedLeadId}`, {
        cache: "no-store",
      }),
    ])

    const memoryPayload = (await memoryRes.json()) as { profile?: GrowthLeadMemoryProfileView }
    const copilotPayload = (await copilotRes.json()) as { assist?: GrowthReplyCopilotAssist }
    const forecastPayload = (await forecastRes.json()) as { evidence?: GrowthRevenueForecastEvidence }
    const executionPlanPayload = (await executionPlanRes.json()) as { plan?: GrowthSalesExecutionPlan }

    if (memoryRes.ok && memoryPayload.profile) setMemoryProfile(memoryPayload.profile)
    else setMemoryProfile(null)

    if (copilotRes.ok && copilotPayload.assist) setCopilot(copilotPayload.assist)
    else setCopilot(null)

    if (forecastRes.ok && forecastPayload.evidence) setForecastEvidence(forecastPayload.evidence)
    else setForecastEvidence(null)

    if (executionPlanRes.ok && executionPlanPayload.plan) setExecutionPlan(executionPlanPayload.plan)
    else if (leadFallback) setExecutionPlan(readExecutionPlanFromLeadMetadata(leadFallback.metadata))
    else setExecutionPlan(null)
  }, [leadId])

  const refresh = useCallback(async () => {
    if (!leadId) {
      clearLeadState()
      return
    }

    await refreshConversationCore()
    await Promise.all([refreshLeadEnrichment(), refreshWorkflow(), refreshRecommendations()])
  }, [leadId, clearLeadState, refreshConversationCore, refreshLeadEnrichment, refreshWorkflow, refreshRecommendations])

  useEffect(() => {
    if (!leadId) {
      clearLeadState()
      return
    }

    let cancelled = false
    void refreshConversationCore().then((loadedLead) => {
      if (cancelled) return
      scheduleGrowthInboxIdleTask(() => {
        if (!cancelled) void refreshLeadEnrichment(loadedLead)
      })
      scheduleGrowthInboxIdleTask(() => {
        if (!cancelled) void refreshWorkflow()
      })
      scheduleGrowthInboxIdleTask(() => {
        if (!cancelled) void refreshRecommendations()
      })
    })

    return () => {
      cancelled = true
    }
  }, [leadId, threadId, clearLeadState, refreshConversationCore, refreshLeadEnrichment, refreshWorkflow, refreshRecommendations])

  const value = useMemo(
    () => ({
      leadId,
      threadId,
      thread,
      loading,
      error,
      memoryProfile,
      timeline,
      copilot,
      lead,
      workflowActions,
      sequenceExitCandidates,
      opportunityRecommendations,
      bookingRecommendations,
      revenueReadiness,
      forecastEvidence,
      executionPlan,
      playbook,
      commandCenterLead,
      refresh,
      refreshWorkflow,
      refreshRecommendations,
    }),
    [
      leadId,
      threadId,
      thread,
      loading,
      error,
      memoryProfile,
      timeline,
      copilot,
      lead,
      workflowActions,
      sequenceExitCandidates,
      opportunityRecommendations,
      bookingRecommendations,
      revenueReadiness,
      forecastEvidence,
      executionPlan,
      playbook,
      commandCenterLead,
      refresh,
      refreshWorkflow,
      refreshRecommendations,
    ],
  )

  return <GrowthInboxLeadContext.Provider value={value}>{children}</GrowthInboxLeadContext.Provider>
}
