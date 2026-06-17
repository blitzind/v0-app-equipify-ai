"use client"

import { useCallback, useEffect, useState } from "react"
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
  type GrowthSalesExecutionDashboard,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

export const GROWTH_INBOX_REPLY_INTELLIGENCE_PANEL_QA_MARKER = "growth-inbox-reply-intelligence-panel-v1" as const

type InboxReplyItem = GrowthOutboundReply & { companyName: string | null }

type GrowthInboxReplyIntelligencePanelProps = {
  leadId: string | null
  compact?: boolean
}

export function GrowthInboxReplyIntelligencePanel({ leadId, compact = false }: GrowthInboxReplyIntelligencePanelProps) {
  const pathname = usePathname()
  const [dashboard, setDashboard] = useState<GrowthSalesExecutionDashboard | null>(null)
  const [leadReply, setLeadReply] = useState<InboxReplyItem | null>(null)
  const [timeline, setTimeline] = useState<GrowthConversationTimelineEntry[]>([])
  const [copilot, setCopilot] = useState<GrowthReplyCopilotAssist | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workflowPath = growthFeaturePath(pathname, "inbox/workflow")
  const adminReplyInboxPath = growthFeaturePath(pathname, "replies")

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: "needs_action", limit: "1" })
      const res = await fetch(`/api/platform/growth/replies/dashboard?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthSalesExecutionDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load reply intelligence.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply intelligence unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeadDetail = useCallback(async (activeLeadId: string) => {
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({ view: "needs_action", limit: "50", leadId: activeLeadId })
      const [timelineRes, copilotRes, inboxRes] = await Promise.all([
        fetch(`/api/platform/growth/replies/timeline?leadId=${activeLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/copilot?leadId=${activeLeadId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/inbox?${params.toString()}`, { cache: "no-store" }),
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
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

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
        <div className={`grid gap-3 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          <StatTile label="Needs review" value={dashboard.needsReviewCount} />
          <StatTile label="Interested" value={dashboard.interestedCount} />
          <StatTile label="Objection-heavy" value={dashboard.objectionHeavyCount} />
          <StatTile label="Workflow tasks" value={dashboard.workflowTaskCount} />
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

          <GrowthEngineCard title="AI reply copilot" icon={<Bot className="size-4" />}>
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading copilot…
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
              <p className="text-sm text-muted-foreground">Copilot assist unavailable for this thread.</p>
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
