"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import { useGrowthConversationsDashboard } from "@/components/growth/inbox/use-growth-conversations-dashboard"
import { useGrowthInboxCallCommunications } from "@/components/growth/inbox/use-growth-inbox-call-communications"
import {
  GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER,
  deriveGrowthInboxConversationOverviewMetrics,
} from "@/lib/growth/inbox/inbox-conversation-overview-metrics"
import { deriveGrowthInboxCallCommunicationMetrics } from "@/lib/growth/inbox/inbox-call-communication-read-model"
import {
  growthWorkspaceCallsHref,
  growthWorkspaceConversationsHref,
  growthWorkspaceInboxWorkflowHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_INBOX_WORKFLOW_INTELLIGENCE_SUMMARY_QA_MARKER =
  "growth-inbox-workflow-intelligence-summary-v1" as const

type CompactIntelligenceCardProps = {
  title: string
  lines: Array<{ label: string; value: number | string }>
  href: string
  linkLabel: string
  qaMarker?: string
  loading?: boolean
  error?: string | null
}

function CompactIntelligenceCard({
  title,
  lines,
  href,
  linkLabel,
  qaMarker,
  loading,
  error,
}: CompactIntelligenceCardProps) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
      data-qa-marker={qaMarker}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line.label}>
              <span className="font-medium text-foreground">{line.value}</span> {line.label}
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
      <Link href={href} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
        {linkLabel}
      </Link>
    </div>
  )
}

/** Phase 8A.1 — intelligence summaries on Workflow tab (not on operator Inbox tab). */
export function GrowthInboxWorkflowIntelligenceSummary() {
  const { dashboard: replyDashboard } = useGrowthReplyIntelligenceDashboard()
  const {
    dashboard: conversationDashboard,
    loading: conversationLoading,
    error: conversationError,
  } = useGrowthConversationsDashboard()
  const { items: callCommunicationItems } = useGrowthInboxCallCommunications()

  const callMetrics = deriveGrowthInboxCallCommunicationMetrics(callCommunicationItems)
  const conversationMetrics = deriveGrowthInboxConversationOverviewMetrics(conversationDashboard)

  return (
    <div
      className="grid gap-3 md:grid-cols-3"
      data-qa-marker={GROWTH_INBOX_WORKFLOW_INTELLIGENCE_SUMMARY_QA_MARKER}
    >
      <CompactIntelligenceCard
        title="Conversation Intelligence"
        lines={[
          { label: "Needs Attention", value: conversationMetrics.needsAttention },
          { label: "High Urgency", value: conversationMetrics.highUrgency },
        ]}
        href={growthWorkspaceConversationsHref()}
        linkLabel="View Conversations →"
        qaMarker={GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER}
        loading={conversationLoading && !conversationDashboard}
        error={
          conversationError
            ? "Conversation metrics unavailable — inbox queue remains fully usable."
            : null
        }
      />

      <CompactIntelligenceCard
        title="Calls"
        lines={[
          { label: "Callbacks", value: callMetrics.callbacks },
          { label: "Follow-Ups", value: callMetrics.callFollowUps },
        ]}
        href={growthWorkspaceCallsHref()}
        linkLabel="View Calls →"
      />

      <CompactIntelligenceCard
        title="Reply Intelligence"
        lines={[
          { label: "Workflow Tasks", value: replyDashboard?.workflowTaskCount ?? 0 },
          { label: "Interested", value: replyDashboard?.interestedCount ?? 0 },
          { label: "Meeting Request", value: replyDashboard?.meetingRequestCount ?? 0 },
        ]}
        href={growthWorkspaceInboxWorkflowHref()}
        linkLabel="View Workflow →"
      />
    </div>
  )
}
