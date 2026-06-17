"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import {
  GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER,
  deriveGrowthInboxOverviewMetrics,
} from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { growthWorkspaceInboxViewHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

const CLICKABLE_OVERVIEW_METRICS: Array<{
  key: keyof ReturnType<typeof deriveGrowthInboxOverviewMetrics>
  label: string
  view?: GrowthInboxQueueView
}> = [
  { key: "needsAction", label: "Needs Action", view: "needs_action" },
  { key: "interested", label: "Interested", view: "interested" },
  { key: "meetingIntent", label: "Meeting Intent", view: "meeting_intent" },
  { key: "objections", label: "Objections", view: "objections" },
  { key: "highPriority", label: "High Priority", view: "high_priority" },
  { key: "workflowTasks", label: "Workflow Tasks" },
  { key: "unreadConversations", label: "Unread Conversations" },
]

export function GrowthInboxOverviewMetricsPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { threads } = useGrowthInboxWorkspace()
  const { dashboard, loading, error, reload } = useGrowthReplyIntelligenceDashboard()

  const metrics = deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard })

  const applyQueueView = useCallback(
    (view: GrowthInboxQueueView) => {
      router.push(growthWorkspaceInboxViewHref(view, searchParams))
    },
    [router, searchParams],
  )

  return (
    <GrowthEngineCard
      title="Inbox Overview"
      data-qa-marker={GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER}
      data-equipify-qa-marker={GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Live thread queue counts plus reply intelligence metrics from the same dashboard source as Admin Reply Inbox.
        </p>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void reload()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CLICKABLE_OVERVIEW_METRICS.map((metric) => {
          const value = metrics[metric.key]
          const content = <StatTile label={metric.label} value={value} />
          if (!metric.view) return <div key={metric.key}>{content}</div>
          return (
            <button
              key={metric.key}
              type="button"
              className="text-left transition hover:opacity-90"
              onClick={() => applyQueueView(metric.view!)}
            >
              {content}
            </button>
          )
        })}
      </div>
    </GrowthEngineCard>
  )
}
