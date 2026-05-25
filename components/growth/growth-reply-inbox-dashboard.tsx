"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Inbox, Loader2, Mail, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import {
  GROWTH_REPLY_INBOX_VIEWS,
  GROWTH_REPLY_INTENT_LABELS,
  GROWTH_REPLY_NEXT_ACTION_LABELS,
  type GrowthReplyInboxDashboard,
  type GrowthReplyInboxView,
  type GrowthReplyIntent,
  type GrowthReplyNextAction,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

type InboxItem = GrowthOutboundReply & { companyName: string | null }

const VIEW_LABELS: Record<GrowthReplyInboxView, string> = {
  my_inbox: "My Inbox",
  needs_action: "Needs Action",
  unanswered: "Unanswered",
  meeting_intent: "Meeting Intent",
  objections: "Objections",
  high_priority: "High Priority",
  competitor_mentions: "Competitor Mentions",
  waiting_on_prospect: "Waiting On Prospect",
}

export function GrowthReplyInboxDashboard() {
  const [dashboard, setDashboard] = useState<GrowthReplyInboxDashboard | null>(null)
  const [items, setItems] = useState<InboxItem[]>([])
  const [view, setView] = useState<GrowthReplyInboxView>("needs_action")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthReplyInboxView) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: activeView, limit: "50" })
      const [dashRes, inboxRes] = await Promise.all([
        fetch(`/api/platform/growth/replies/dashboard?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/replies/inbox?${params.toString()}`, { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthReplyInboxDashboard
        message?: string
      }
      const inboxData = (await inboxRes.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: InboxItem[] }
        message?: string
      }
      if (!dashRes.ok || !dashData.ok || !dashData.dashboard) {
        throw new Error(dashData.message ?? "Could not load reply dashboard.")
      }
      if (!inboxRes.ok || !inboxData.ok) {
        throw new Error(inboxData.message ?? "Could not load reply inbox.")
      }
      setDashboard(dashData.dashboard)
      setItems(inboxData.feed?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(view)
  }, [load, view])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading reply intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_REPLY_INBOX_VIEWS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option ? "default" : "outline"}
              onClick={() => setView(option)}
            >
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={dashboard.qaMarker} tone="healthy" />
            <GrowthBadge label={`View: ${VIEW_LABELS[view]}`} tone="neutral" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<Inbox className="size-3.5" />} label="Total replies" value={dashboard.totalReplies} />
            <StatTile label="High priority" value={dashboard.highPriorityCount + dashboard.criticalCount} />
            <StatTile label="Meeting requests" value={dashboard.meetingRequestCount} />
            <StatTile label="Competitor mentions" value={dashboard.competitorMentionCount} />
            <StatTile label="Unanswered" value={dashboard.unansweredCount} />
            <StatTile label="Owner waiting" value={dashboard.ownerWaitingCount} />
            <StatTile label="Overdue SLA" value={dashboard.overdueCount} />
            <StatTile label="Avg response latency" value={`${dashboard.averageResponseLatencyMs}ms`} />
          </div>
        </>
      ) : null}

      <GrowthEngineCard title="Reply inbox queue">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies match this view. Inbound replies appear here after webhook processing.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.companyName ?? "Unknown company"}</p>
                    <p className="text-muted-foreground line-clamp-2">{item.bodyPreview ?? "No preview available."}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <GrowthBadge
                      label={GROWTH_REPLY_INTENT_LABELS[(item.intent as GrowthReplyIntent) ?? "unknown"] ?? "Unknown"}
                      tone="attention"
                    />
                    <GrowthBadge label={item.priority} tone={item.priority === "critical" ? "critical" : "neutral"} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="size-3.5" />
                  <span>
                    Next:{" "}
                    {item.nextAction
                      ? GROWTH_REPLY_NEXT_ACTION_LABELS[item.nextAction as GrowthReplyNextAction]
                      : "Manual review"}
                  </span>
                  <span>· Thread {item.threadReplyCount}</span>
                  {item.unanswered ? <span>· Unanswered</span> : null}
                  {item.ownerWaiting ? <span>· Waiting on prospect</span> : null}
                  <Link href={`/admin/growth/leads?leadId=${item.leadId}`} className="font-medium text-indigo-600 hover:underline">
                    Open lead
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
