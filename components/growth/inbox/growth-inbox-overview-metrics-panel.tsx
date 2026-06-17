"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import {
  GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER,
  deriveGrowthInboxOverviewMetrics,
} from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import { deriveGrowthInboxCallCommunicationMetrics } from "@/lib/growth/inbox/inbox-call-communication-read-model"
import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { growthWorkspaceInboxViewHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

const PRIMARY_OPERATOR_METRICS: Array<{
  id: string
  label: string
  view?: GrowthInboxQueueView
  resolveValue: (
    metrics: ReturnType<typeof deriveGrowthInboxOverviewMetrics>,
    callMetrics: ReturnType<typeof deriveGrowthInboxCallCommunicationMetrics>,
  ) => number
}> = [
  {
    id: "needsAction",
    label: "Needs Action",
    view: "needs_action",
    resolveValue: (metrics) => metrics.needsAction,
  },
  {
    id: "interested",
    label: "Interested",
    view: "interested",
    resolveValue: (metrics) => metrics.interested,
  },
  {
    id: "meetings",
    label: "Meetings",
    view: "meeting_intent",
    resolveValue: (metrics) => metrics.meetingIntent,
  },
  {
    id: "callbacks",
    label: "Callbacks",
    view: "callback_requested",
    resolveValue: (_, callMetrics) => callMetrics.callbacks,
  },
  {
    id: "workflowTasks",
    label: "Workflow",
    resolveValue: (metrics) => metrics.workflowTasks,
  },
  {
    id: "unread",
    label: "Unread",
    resolveValue: (metrics) => metrics.unreadConversations,
  },
]

/** Phase 8A.1 — six operator metrics only; intelligence summaries live on Workflow tab. */
export function GrowthInboxOverviewMetricsPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { threads } = useGrowthInboxWorkspace()
  const { callCommunicationItems } = useGrowthInboxQueue()
  const { dashboard, loading, error, reload } = useGrowthReplyIntelligenceDashboard()

  const metrics = deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard })
  const callMetrics = deriveGrowthInboxCallCommunicationMetrics(callCommunicationItems)

  const applyQueueView = useCallback(
    (view: GrowthInboxQueueView) => {
      router.push(growthWorkspaceInboxViewHref(view, searchParams))
    },
    [router, searchParams],
  )

  return (
    <div
      data-qa-marker={GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER}
      data-equipify-qa-marker={GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER}
    >
      <div className="mb-2 flex items-center justify-end">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={loading} onClick={() => void reload()}>
          {loading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="mb-2 text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {PRIMARY_OPERATOR_METRICS.map((metric) => {
          const value = metric.resolveValue(metrics, callMetrics)
          const content = <StatTile label={metric.label} value={value} />
          if (!metric.view) return <div key={metric.id}>{content}</div>
          return (
            <button
              key={metric.id}
              type="button"
              className="text-left transition hover:opacity-90"
              onClick={() => applyQueueView(metric.view!)}
            >
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}
