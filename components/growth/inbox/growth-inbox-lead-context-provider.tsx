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
import type { GrowthReplyWorkflowActionRecord } from "@/lib/growth/reply-intelligence/workflow-actions-types"
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
  opportunityRecommendations: GrowthOpportunityRecommendation[]
  bookingRecommendations: GrowthBookingRecommendation[]
  revenueReadiness: GrowthRevenueReadinessSnapshot | null
  forecastEvidence: GrowthRevenueForecastEvidence | null
  executionPlan: GrowthSalesExecutionPlan | null
  playbook: GrowthRevenuePlaybook | null
  commandCenterLead: GrowthRevenueCommandCenterLead | null
  refresh: () => Promise<void>
}

const GrowthInboxLeadContext = createContext<GrowthInboxLeadContextValue | null>(null)

export function useGrowthInboxLeadContext(): GrowthInboxLeadContextValue {
  const value = useContext(GrowthInboxLeadContext)
  if (!value) {
    throw new Error("useGrowthInboxLeadContext must be used within GrowthInboxLeadContextProvider")
  }
  return value
}

function findCommandCenterLead(
  dashboard: {
    sections?: Record<string, GrowthRevenueCommandCenterLead[]>
  } | null,
  leadId: string,
): GrowthRevenueCommandCenterLead | null {
  if (!dashboard?.sections) return null
  for (const leads of Object.values(dashboard.sections)) {
    const match = leads.find((entry) => entry.leadId === leadId)
    if (match) return match
  }
  return null
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoryProfile, setMemoryProfile] = useState<GrowthLeadMemoryProfileView | null>(null)
  const [timeline, setTimeline] = useState<GrowthConversationTimelineEntry[]>([])
  const [copilot, setCopilot] = useState<GrowthReplyCopilotAssist | null>(null)
  const [lead, setLead] = useState<GrowthLead | null>(null)
  const [workflowActions, setWorkflowActions] = useState<GrowthReplyWorkflowActionRecord[]>([])
  const [opportunityRecommendations, setOpportunityRecommendations] = useState<GrowthOpportunityRecommendation[]>([])
  const [bookingRecommendations, setBookingRecommendations] = useState<GrowthBookingRecommendation[]>([])
  const [forecastEvidence, setForecastEvidence] = useState<GrowthRevenueForecastEvidence | null>(null)
  const [executionPlan, setExecutionPlan] = useState<GrowthSalesExecutionPlan | null>(null)
  const [commandCenterLead, setCommandCenterLead] = useState<GrowthRevenueCommandCenterLead | null>(null)

  const revenueReadiness = useMemo(() => readRevenueReadinessForLead(lead), [lead])

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

  const refresh = useCallback(async () => {
    if (!leadId) {
      setMemoryProfile(null)
      setTimeline([])
      setCopilot(null)
      setLead(null)
      setWorkflowActions([])
      setOpportunityRecommendations([])
      setBookingRecommendations([])
      setForecastEvidence(null)
      setExecutionPlan(null)
      setCommandCenterLead(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const encodedLeadId = encodeURIComponent(leadId)
      const workflowParams = new URLSearchParams({ status: "pending_review", limit: "20", leadId })
      const bookingParams = new URLSearchParams({ leadId, status: "pending_review" })

      const [
        memoryRes,
        timelineRes,
        copilotRes,
        leadRes,
        workflowRes,
        opportunityDashboardRes,
        bookingRes,
        forecastRes,
        executionPlanRes,
        commandCenterRes,
      ] = await Promise.all([
        fetch(`/api/platform/growth/lead-memory/profile/${encodedLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/timeline?leadId=${encodedLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/copilot?leadId=${encodedLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/leads/${encodedLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/workflow-actions?${workflowParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/opportunities/dashboard?leadId=${encodedLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/booking-intelligence/recommendations?${bookingParams.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/platform/growth/revenue-execution/forecast-evidence?leadId=${encodedLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/revenue-execution/execution-plan?leadId=${encodedLeadId}`, { cache: "no-store" }),
        fetch("/api/platform/growth/revenue-execution/command-center", { cache: "no-store" }),
      ])

      const memoryPayload = (await memoryRes.json()) as { profile?: GrowthLeadMemoryProfileView }
      const timelinePayload = (await timelineRes.json()) as { timeline?: { entries?: GrowthConversationTimelineEntry[] } }
      const copilotPayload = (await copilotRes.json()) as { assist?: GrowthReplyCopilotAssist }
      const leadPayload = (await leadRes.json()) as { lead?: GrowthLead }
      const workflowPayload = (await workflowRes.json()) as { items?: GrowthReplyWorkflowActionRecord[] }
      const opportunityDashboardPayload = (await opportunityDashboardRes.json()) as {
        intelligence?: { recommendedActions?: GrowthOpportunityRecommendation[] }
      }
      const bookingPayload = (await bookingRes.json()) as { recommendations?: GrowthBookingRecommendation[] }
      const forecastPayload = (await forecastRes.json()) as { evidence?: GrowthRevenueForecastEvidence }
      const executionPlanPayload = (await executionPlanRes.json()) as { plan?: GrowthSalesExecutionPlan }
      const commandCenterPayload = (await commandCenterRes.json()) as {
        dashboard?: { sections?: Record<string, GrowthRevenueCommandCenterLead[]> }
      }

      if (memoryRes.ok && memoryPayload.profile) setMemoryProfile(memoryPayload.profile)
      else setMemoryProfile(null)

      if (timelineRes.ok) setTimeline(timelinePayload.timeline?.entries ?? [])
      else setTimeline([])

      if (copilotRes.ok && copilotPayload.assist) setCopilot(copilotPayload.assist)
      else setCopilot(null)

      if (leadRes.ok && leadPayload.lead) setLead(leadPayload.lead)
      else setLead(null)

      if (workflowRes.ok) setWorkflowActions(workflowPayload.items ?? [])
      else setWorkflowActions([])

      const recommendations = (opportunityDashboardPayload.intelligence?.recommendedActions ?? []).filter(
        (recommendation) => !recommendation.inboxThreadId || !threadId || recommendation.inboxThreadId === threadId,
      )
      setOpportunityRecommendations(recommendations)

      const bookings = (bookingPayload.recommendations ?? []).filter(
        (recommendation) => !recommendation.inboxThreadId || !threadId || recommendation.inboxThreadId === threadId,
      )
      setBookingRecommendations(bookings)

      if (forecastRes.ok && forecastPayload.evidence) setForecastEvidence(forecastPayload.evidence)
      else setForecastEvidence(null)

      if (executionPlanRes.ok && executionPlanPayload.plan) setExecutionPlan(executionPlanPayload.plan)
      else if (leadPayload.lead) setExecutionPlan(readExecutionPlanFromLeadMetadata(leadPayload.lead.metadata))
      else setExecutionPlan(null)

      if (commandCenterRes.ok) {
        setCommandCenterLead(findCommandCenterLead(commandCenterPayload.dashboard ?? null, leadId))
      } else {
        setCommandCenterLead(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load lead context.")
    } finally {
      setLoading(false)
    }
  }, [leadId, threadId])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
      opportunityRecommendations,
      bookingRecommendations,
      revenueReadiness,
      forecastEvidence,
      executionPlan,
      playbook,
      commandCenterLead,
      refresh,
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
      opportunityRecommendations,
      bookingRecommendations,
      revenueReadiness,
      forecastEvidence,
      executionPlan,
      playbook,
      commandCenterLead,
      refresh,
    ],
  )

  return <GrowthInboxLeadContext.Provider value={value}>{children}</GrowthInboxLeadContext.Provider>
}
