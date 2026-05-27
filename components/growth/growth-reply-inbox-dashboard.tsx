"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, History, Inbox, Loader2, Mail, MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import {
  GROWTH_REPLY_INBOX_VIEWS,
  GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
  GROWTH_REPLY_INTENT_LABELS,
  GROWTH_REPLY_NEXT_ACTION_LABELS,
  GROWTH_REPLY_SALES_EXECUTION_VIEWS,
  type GrowthConversationTimelineEntry,
  type GrowthReplyCopilotAssist,
  type GrowthReplyInboxView,
  type GrowthReplyIntent,
  type GrowthReplyNextAction,
  type GrowthReplySalesExecutionView,
  type GrowthSalesExecutionDashboard,
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

const SALES_VIEW_LABELS: Record<GrowthReplySalesExecutionView, string> = {
  needs_review: "Needs review",
  interested: "Interested",
  demo_requests: "Demo requests",
  pricing_questions: "Pricing",
  objection_heavy: "Objections",
  stop_unsubscribe: "Stop / unsubscribe",
  angry_complaint: "Complaints",
  low_confidence: "Low confidence",
  workflow_tasks: "Workflow tasks",
}

export function GrowthReplyInboxDashboard() {
  const [dashboard, setDashboard] = useState<GrowthSalesExecutionDashboard | null>(null)
  const [items, setItems] = useState<InboxItem[]>([])
  const [view, setView] = useState<GrowthReplyInboxView>("needs_action")
  const [salesView, setSalesView] = useState<GrowthReplySalesExecutionView | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<GrowthConversationTimelineEntry[]>([])
  const [copilot, setCopilot] = useState<GrowthReplyCopilotAssist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTimeline = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/platform/growth/replies/timeline?leadId=${leadId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      timeline?: { entries?: GrowthConversationTimelineEntry[] }
    }
    if (res.ok && data.ok) setTimeline(data.timeline?.entries ?? [])
  }, [])

  const loadCopilot = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/platform/growth/replies/copilot?leadId=${leadId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; assist?: GrowthReplyCopilotAssist }
    if (res.ok && data.ok && data.assist) setCopilot(data.assist)
  }, [])

  const load = useCallback(
    async (activeView: GrowthReplyInboxView, activeSalesView: GrowthReplySalesExecutionView | null) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ view: activeView, limit: "50" })
        if (activeSalesView && activeSalesView !== "workflow_tasks") {
          params.set("salesExecutionView", activeSalesView)
        }
        const [dashRes, inboxRes] = await Promise.all([
          fetch(`/api/platform/growth/replies/dashboard?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/platform/growth/replies/inbox?${params.toString()}`, { cache: "no-store" }),
        ])
        const dashData = (await dashRes.json().catch(() => ({}))) as {
          ok?: boolean
          dashboard?: GrowthSalesExecutionDashboard
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
    },
    [],
  )

  useEffect(() => {
    void load(view, salesView)
  }, [load, view, salesView])

  useEffect(() => {
    if (!selectedLeadId) {
      setTimeline([])
      setCopilot(null)
      return
    }
    void loadTimeline(selectedLeadId)
    void loadCopilot(selectedLeadId)
  }, [selectedLeadId, loadTimeline, loadCopilot])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading reply intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_REPLY_INBOX_VIEWS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option && !salesView ? "default" : "outline"}
              onClick={() => {
                setSalesView(null)
                setView(option)
              }}
            >
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view, salesView)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={`View: ${salesView ? SALES_VIEW_LABELS[salesView] : VIEW_LABELS[view]}`} tone="neutral" />
            <GrowthBadge label={dashboard.v2QaMarker ?? GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER} tone="attention" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<Inbox className="size-3.5" />} label="Total replies" value={dashboard.totalReplies} />
            <StatTile label="Needs review" value={dashboard.needsReviewCount} />
            <StatTile label="Interested" value={dashboard.interestedCount} />
            <StatTile label="Demo requests" value={dashboard.demoRequestCount} />
            <StatTile label="Pricing questions" value={dashboard.pricingQuestionCount} />
            <StatTile label="Objection-heavy" value={dashboard.objectionHeavyCount} />
            <StatTile label="Stop / unsubscribe" value={dashboard.stopUnsubscribeCount} />
            <StatTile label="Complaints" value={dashboard.angryComplaintCount} />
            <StatTile label="Low confidence" value={dashboard.lowConfidenceCount} />
            <StatTile label="Workflow tasks" value={dashboard.workflowTaskCount} />
            <StatTile label="Positive reply rate" value={`${dashboard.campaignLearning.positiveReplyRate}%`} />
            <StatTile label="Objection rate" value={`${dashboard.campaignLearning.objectionRate}%`} />
          </div>

          <GrowthEngineCard title="Sales execution filters">
            <div className="flex flex-wrap gap-2">
              {GROWTH_REPLY_SALES_EXECUTION_VIEWS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={salesView === option ? "default" : "outline"}
                  onClick={() => setSalesView(salesView === option ? null : option)}
                >
                  {SALES_VIEW_LABELS[option]}
                </Button>
              ))}
            </div>
          </GrowthEngineCard>
        </>
      ) : null}

      <GrowthEngineCard title="Reply inbox queue">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No replies match this view. Inbound replies appear here after webhook or mailbox sync processing.
          </p>
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
                  <button
                    type="button"
                    className="font-medium text-indigo-600 hover:underline"
                    onClick={() => setSelectedLeadId(item.leadId)}
                  >
                    Timeline & copilot
                  </button>
                  <Link href={`/admin/growth/leads?leadId=${item.leadId}`} className="font-medium text-indigo-600 hover:underline">
                    Open lead
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      {selectedLeadId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div data-qa-marker={GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}>
            <GrowthEngineCard title="Conversation timeline" icon={<History className="size-4" />}>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline events for this lead yet.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border px-3 py-2">
                      <p className="font-medium">{entry.title}</p>
                      <p className="text-muted-foreground">{entry.summary}</p>
                      {entry.evidenceExcerpt ? (
                        <p className="mt-1 text-xs italic text-muted-foreground">"{entry.evidenceExcerpt}"</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          </div>

          <div data-qa-marker={GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}>
            <GrowthEngineCard title="AI reply copilot" icon={<Bot className="size-4" />}>
              {!copilot ? (
                <p className="text-sm text-muted-foreground">Select a reply to load copilot assist.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <GrowthBadge label={copilot.assistedLabel} tone="attention" />
                  <p>{copilot.summary}</p>
                  <p>
                    <span className="font-medium">Suggested next step:</span> {copilot.suggestedNextStep}
                  </p>
                  <div>
                    <p className="font-medium">Suggested reply draft (human approval required)</p>
                    <p className="mt-1 rounded-md bg-muted/40 p-2 text-muted-foreground">{copilot.suggestedReplyDraft}</p>
                  </div>
                  <div>
                    <p className="font-medium">Internal note</p>
                    <p className="text-muted-foreground">{copilot.suggestedInternalNote}</p>
                  </div>
                  {copilot.callPrepBullets.length > 0 ? (
                    <div>
                      <p className="font-medium">Call prep</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {copilot.callPrepBullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Confidence: {copilot.confidenceTier} · Uncertainty: {copilot.uncertaintyState}
                  </p>
                </div>
              )}
            </GrowthEngineCard>
          </div>
        </div>
      ) : (
        <GrowthEngineCard title="Conversation & copilot" icon={<MessageSquare className="size-4" />}>
          <p className="text-sm text-muted-foreground">
            Select a reply above to open the evidence-backed conversation timeline and AI-assisted reply copilot.
          </p>
        </GrowthEngineCard>
      )}
    </div>
  )
}
