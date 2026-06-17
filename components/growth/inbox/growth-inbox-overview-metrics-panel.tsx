"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import { useGrowthConversationsDashboard } from "@/components/growth/inbox/use-growth-conversations-dashboard"
import {
  GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER,
  deriveGrowthInboxOverviewMetrics,
} from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import {
  GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER,
  deriveGrowthInboxConversationOverviewMetrics,
} from "@/lib/growth/inbox/inbox-conversation-overview-metrics"
import {
  deriveGrowthInboxCallCommunicationMetrics,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"
import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import {
  growthWorkspaceConversationsHref,
  growthWorkspaceInboxViewHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

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

const CLICKABLE_CALL_OVERVIEW_METRICS: Array<{
  label: string
  view: GrowthInboxQueueView
  metricKey: keyof ReturnType<typeof deriveGrowthInboxCallCommunicationMetrics>
}> = [
  { label: "Callbacks", view: "callback_requested", metricKey: "callbacks" },
  { label: "Voicemails", view: "voicemail", metricKey: "voicemails" },
  { label: "Missed Calls", view: "callback_requested", metricKey: "missedCalls" },
  { label: "Call Follow-Ups", view: "call_follow_up", metricKey: "callFollowUps" },
]

const CLICKABLE_CONVERSATION_OVERVIEW_METRICS: Array<{
  label: string
  metricKey: keyof ReturnType<typeof deriveGrowthInboxConversationOverviewMetrics>
}> = [
  { label: "Needs Attention", metricKey: "needsAttention" },
  { label: "Negative Sentiment", metricKey: "negativeSentiment" },
  { label: "High Urgency", metricKey: "highUrgency" },
  { label: "Strong Buying Intent", metricKey: "strongBuyingIntent" },
  { label: "Active Leads", metricKey: "activeConversationLeads" },
  { label: "Avg Health", metricKey: "averageHealth" },
]

export function GrowthInboxOverviewMetricsPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { threads } = useGrowthInboxWorkspace()
  const { callCommunicationItems } = useGrowthInboxQueue()
  const { dashboard, loading, error, reload } = useGrowthReplyIntelligenceDashboard()
  const {
    dashboard: conversationDashboard,
    loading: conversationLoading,
    error: conversationError,
    reload: reloadConversations,
  } = useGrowthConversationsDashboard()

  const metrics = deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard })
  const callMetrics = deriveGrowthInboxCallCommunicationMetrics(callCommunicationItems)
  const conversationMetrics = deriveGrowthInboxConversationOverviewMetrics(conversationDashboard)
  const conversationsHref = growthWorkspaceConversationsHref()
  const refreshing = loading || conversationLoading

  const applyQueueView = useCallback(
    (view: GrowthInboxQueueView) => {
      router.push(growthWorkspaceInboxViewHref(view, searchParams))
    },
    [router, searchParams],
  )

  const refreshAll = useCallback(() => {
    void reload()
    void reloadConversations()
  }, [reload, reloadConversations])

  return (
    <GrowthEngineCard
      title="Inbox Overview"
      data-qa-marker={GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER}
      data-equipify-qa-marker={GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Live thread queue counts, reply intelligence, call communication metrics, and read-only conversation
          portfolio summaries from the existing conversations dashboard.
        </p>
        <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={refreshAll}>
          {refreshing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CLICKABLE_CALL_OVERVIEW_METRICS.map((metric) => {
          const value = callMetrics[metric.metricKey]
          return (
            <button
              key={metric.label}
              type="button"
              className="text-left transition hover:opacity-90"
              onClick={() => applyQueueView(metric.view)}
            >
              <StatTile label={metric.label} value={value} />
            </button>
          )
        })}
      </div>

      <div
        className="mt-6 space-y-3"
        data-qa-marker={GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Conversation Intelligence
          </p>
          <Link href={conversationsHref} className="text-xs text-primary hover:underline">
            View in Conversations
          </Link>
        </div>

        {conversationLoading && !conversationDashboard ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading conversation metrics…
          </div>
        ) : null}

        {conversationError ? (
          <p className="text-sm text-amber-700">
            Conversation metrics unavailable — inbox queue remains fully usable.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CLICKABLE_CONVERSATION_OVERVIEW_METRICS.map((metric) => {
            const value = conversationMetrics[metric.metricKey]
            return (
              <Link
                key={metric.label}
                href={conversationsHref}
                className="text-left transition hover:opacity-90"
              >
                <StatTile label={metric.label} value={value} />
              </Link>
            )
          })}
        </div>
      </div>
    </GrowthEngineCard>
  )
}
