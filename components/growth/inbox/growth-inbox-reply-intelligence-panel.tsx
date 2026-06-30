"use client"

import { useCallback, useEffect, useState } from "react"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, History, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
  GROWTH_REPLY_INTENT_LABELS,
  GROWTH_REPLY_NEXT_ACTION_LABELS,
  type GrowthConversationTimelineEntry,
  type GrowthReplyCopilotAssist,
  type GrowthReplyIntent,
  type GrowthReplyNextAction,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import { isCommunicationStrategyEnabledClient } from "@/lib/growth/contact-verification/communication-strategy-feature"
import {
  GROWTH_AVA_EMPTY_ASSIST_UNAVAILABLE,
  GROWTH_AVA_REPLY_ASSIST_TITLE,
} from "@/lib/growth/workspace/growth-workspace-ava-identity"
import type { CommunicationStrategyDisplaySummary } from "@/lib/growth/contact-verification/communication-strategy-view"

export const GROWTH_INBOX_REPLY_INTELLIGENCE_PANEL_QA_MARKER = "growth-inbox-reply-intelligence-panel-v2" as const

type InboxReplyItem = GrowthOutboundReply & { companyName: string | null }

type GrowthInboxReplyIntelligencePanelProps = {
  leadId: string | null
  compact?: boolean
}

export function GrowthInboxReplyIntelligencePanel({ leadId, compact = false }: GrowthInboxReplyIntelligencePanelProps) {
  const pathname = usePathname()
  const { dashboard, loading, error, reload: loadDashboard } = useGrowthReplyIntelligenceDashboard()
  const [leadReply, setLeadReply] = useState<InboxReplyItem | null>(null)
  const [timeline, setTimeline] = useState<GrowthConversationTimelineEntry[]>([])
  const [copilot, setCopilot] = useState<GrowthReplyCopilotAssist | null>(null)
  const [communicationStrategy, setCommunicationStrategy] =
    useState<CommunicationStrategyDisplaySummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const workflowPath = growthFeaturePath(pathname, "inbox/workflow")
  const adminReplyInboxPath = growthFeaturePath(pathname, "replies")

  const loadLeadDetail = useCallback(async (activeLeadId: string) => {
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({ view: "needs_action", limit: "50", leadId: activeLeadId })
      const strategyEnabled = isCommunicationStrategyEnabledClient()
      const [timelineRes, copilotRes, inboxRes, strategyRes] = await Promise.all([
        fetch(`/api/platform/growth/replies/timeline?leadId=${activeLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/copilot?leadId=${activeLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/inbox?${params.toString()}`, { cache: "no-store" }),
        strategyEnabled
          ? fetch(`/api/platform/growth/leads/${encodeURIComponent(activeLeadId)}/communication-strategy`, {
              cache: "no-store",
            })
          : Promise.resolve(null),
      ])

      const timelineData = (await timelineRes.json().catch(() => ({}))) as {
        ok?: boolean
        timeline?: { entries?: GrowthConversationTimelineEntry[] }
      }
      const copilotData = (await copilotRes.json().catch(() => ({}))) as {
        ok?: boolean
        assist?: GrowthReplyCopilotAssist
      }
      const inboxData = (await inboxRes.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: InboxReplyItem[] }
      }

      if (timelineRes.ok && timelineData.ok) {
        setTimeline(timelineData.timeline?.entries ?? [])
      } else {
        setTimeline([])
      }

      if (copilotRes.ok && copilotData.ok && copilotData.assist) {
        setCopilot(copilotData.assist)
      } else {
        setCopilot(null)
      }

      const items = inboxData.feed?.items ?? []
      setLeadReply(items.find((item) => item.leadId === activeLeadId) ?? items[0] ?? null)

      if (strategyRes) {
        const strategyData = (await strategyRes.json().catch(() => ({}))) as {
          ok?: boolean
          communication_strategy?: CommunicationStrategyDisplaySummary | null
        }
        setCommunicationStrategy(
          strategyRes.ok && strategyData.ok ? strategyData.communication_strategy ?? null : null,
        )
      } else {
        setCommunicationStrategy(null)
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!leadId) {
      setTimeline([])
      setCopilot(null)
      setLeadReply(null)
      return
    }
    void loadLeadDetail(leadId)
  }, [leadId, loadLeadDetail])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading reply intelligence…
      </div>
    )
  }

  return (
    <div
      className="space-y-4"
      data-qa-marker={GROWTH_INBOX_REPLY_INTELLIGENCE_PANEL_QA_MARKER}
      data-equipify-qa-marker={GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Reply Intelligence</h2>
          <p className="text-xs text-muted-foreground">
            Evidence-backed classifications, timeline, and copilot recommendations for the selected thread.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void loadDashboard()}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={adminReplyInboxPath}>Admin reply inbox</Link>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {dashboard ? (
        <div className={`grid gap-3 ${compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-5"}`}>
          <StatTile label="Needs review" value={dashboard.needsReviewCount} />
          <StatTile label="Interested" value={dashboard.interestedCount} />
          <StatTile label="Objection-heavy" value={dashboard.objectionHeavyCount} />
          <StatTile label="Workflow tasks" value={dashboard.workflowTaskCount} />
          <StatTile label="Meeting requests" value={dashboard.meetingRequestCount} />
        </div>
      ) : null}

      {leadId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GrowthEngineCard title="Reply classification" icon={<History className="size-4" />}>
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading reply context…
              </div>
            ) : leadReply ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <GrowthBadge
                    label={
                      GROWTH_REPLY_INTENT_LABELS[(leadReply.intent as GrowthReplyIntent) ?? "unknown"] ?? "Unknown"
                    }
                    tone="attention"
                  />
                  <GrowthBadge
                    label={leadReply.priority}
                    tone={leadReply.priority === "critical" ? "critical" : "neutral"}
                  />
                </div>
                <p className="text-muted-foreground line-clamp-3">{leadReply.bodyPreview ?? "No preview available."}</p>
                <p className="text-xs text-muted-foreground">
                  Next:{" "}
                  {leadReply.nextAction
                    ? GROWTH_REPLY_NEXT_ACTION_LABELS[leadReply.nextAction as GrowthReplyNextAction]
                    : "Manual review"}
                </p>
                <Link href={workflowPath} className="text-xs font-medium text-indigo-600 hover:underline">
                  Open workflow actions
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reply intelligence feed item for this lead yet.</p>
            )}
          </GrowthEngineCard>

          {communicationStrategy ? (
            <GrowthEngineCard title="Communication strategy" icon={<Bot className="size-4" />}>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{communicationStrategy.recommended_action_label}</p>
                <p className="text-muted-foreground">
                  Primary channel: {communicationStrategy.primary_channel_label}
                  {communicationStrategy.fallback_channels.length > 0
                    ? ` · Then: ${communicationStrategy.fallback_channels.slice(0, 2).join(", ")}`
                    : ""}
                </p>
                {communicationStrategy.reasoning[0] ? (
                  <p className="text-xs text-muted-foreground">{communicationStrategy.reasoning[0]}</p>
                ) : null}
              </div>
            </GrowthEngineCard>
          ) : null}

          <GrowthEngineCard title={GROWTH_AVA_REPLY_ASSIST_TITLE} icon={<Bot className="size-4" />}>
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading Ava…
              </div>
            ) : copilot ? (
              <div className="space-y-2 text-sm">
                <GrowthBadge label={copilot.assistedLabel} tone="attention" />
                <p>{copilot.summary}</p>
                <p>
                  <span className="font-medium">Suggested next step:</span> {copilot.suggestedNextStep}
                </p>
                <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{copilot.suggestedReplyDraft}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{GROWTH_AVA_EMPTY_ASSIST_UNAVAILABLE}</p>
            )}
          </GrowthEngineCard>

          <GrowthEngineCard title="Conversation timeline" icon={<History className="size-4" />} className="lg:col-span-2">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading timeline…
              </div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No timeline events for this lead yet.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {timeline.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-border px-3 py-2">
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-muted-foreground">{entry.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>
        </div>
      ) : (
        <GrowthEngineCard title="Reply intelligence">
          <p className="text-sm text-muted-foreground">
            Select a thread in the queue to load classifications, timeline events, and copilot recommendations.
          </p>
        </GrowthEngineCard>
      )}
    </div>
  )
}
