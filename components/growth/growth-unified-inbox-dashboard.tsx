"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthReplyDraftingPanel } from "@/components/growth/growth-reply-drafting-panel"
import { GrowthInboxOpportunityIntelligencePanel } from "@/components/growth/growth-inbox-opportunity-intelligence-panel"
import { GrowthInboxTeamQueuePanel } from "@/components/growth/growth-inbox-team-queue-panel"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import { priorityTierLabel } from "@/lib/growth/inbox/thread-priority"
import { threadStatusLabel } from "@/lib/growth/inbox/thread-health"
import type {
  GrowthInboxDashboard,
  GrowthInboxMessage,
  GrowthInboxThread,
  GrowthReplyIntelligenceEvent,
  GrowthReplyIntelligenceSummary,
} from "@/lib/growth/inbox/inbox-types"
import { GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER } from "@/lib/growth/inbox/inbox-types"
import {
  GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER,
  type GrowthInboxSyncDashboard,
  type GrowthInboxThreadSyncDetail,
  inboxSyncStatusLabel,
} from "@/lib/growth/inbox-sync/inbox-sync-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  open: "healthy",
  waiting: "neutral",
  needs_review: "attention",
  resolved: "healthy",
  archived: "blocked",
  low: "neutral",
  normal: "healthy",
  high: "attention",
  critical: "critical",
}

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type ListPayload = {
  ok?: boolean
  threads?: GrowthInboxThread[]
  leads?: Array<{ id: string; label: string }>
  message?: string
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxDashboard
  threads?: GrowthInboxThread[]
  intelligence?: GrowthReplyIntelligenceSummary
  events?: GrowthReplyIntelligenceEvent[]
  message?: string
}

type SyncDashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxSyncDashboard
  message?: string
}

type ThreadDetailPayload = {
  thread?: GrowthInboxThread
  syncDetail?: GrowthInboxThreadSyncDetail | null
  message?: string
}

export function GrowthUnifiedInboxDashboardPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthInboxDashboard | null>(null)
  const [threads, setThreads] = useState<GrowthInboxThread[]>([])
  const [events, setEvents] = useState<GrowthReplyIntelligenceEvent[]>([])
  const [intelligence, setIntelligence] = useState<GrowthReplyIntelligenceSummary | null>(null)
  const [syncDashboard, setSyncDashboard] = useState<GrowthInboxSyncDashboard | null>(null)
  const [syncDetail, setSyncDetail] = useState<GrowthInboxThreadSyncDetail | null>(null)
  const [leads, setLeads] = useState<Array<{ id: string; label: string }>>([])
  const [selectedThreadId, setSelectedThreadId] = useState("")
  const [newLeadId, setNewLeadId] = useState("")
  const [newSubject, setNewSubject] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [messageDirection, setMessageDirection] = useState<"inbound" | "outbound">("inbound")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId],
  )

  const selectedMessages = useMemo(() => selectedThread?.messages ?? [], [selectedThread])

  const loadThreadDetail = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/platform/growth/inbox/thread/${threadId}`)
    const payload = (await response.json()) as ThreadDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not load thread detail.")
    if (payload.thread) {
      setThreads((current) => current.map((thread) => (thread.id === threadId ? payload.thread! : thread)))
    }
    setSyncDetail(payload.syncDetail ?? null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listResponse, dashboardResponse, syncResponse] = await Promise.all([
        fetch("/api/platform/growth/inbox"),
        fetch("/api/platform/growth/inbox/dashboard"),
        fetch("/api/platform/growth/inbox/sync/dashboard"),
      ])
      const listPayload = (await listResponse.json()) as ListPayload
      const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
      const syncPayload = (await syncResponse.json()) as SyncDashboardPayload
      if (!listResponse.ok) throw new Error(listPayload.message ?? "Could not load inbox threads.")
      if (!dashboardResponse.ok) throw new Error(dashboardPayload.message ?? "Could not load inbox dashboard.")

      const mergedThreads = dashboardPayload.threads ?? listPayload.threads ?? []
      setThreads(mergedThreads)
      setLeads(listPayload.leads ?? [])
      setDashboard(dashboardPayload.dashboard ?? null)
      setIntelligence(dashboardPayload.intelligence ?? null)
      setEvents(dashboardPayload.events ?? [])
      if (syncResponse.ok && syncPayload.dashboard) setSyncDashboard(syncPayload.dashboard)

      const nextSelected = selectedThreadId || mergedThreads[0]?.id || ""
      if (nextSelected && !selectedThreadId) setSelectedThreadId(nextSelected)
      if (nextSelected) await loadThreadDetail(nextSelected)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load unified inbox.")
    } finally {
      setLoading(false)
    }
  }, [loadThreadDetail, selectedThreadId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Inbox action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function createThread() {
    const response = await fetch("/api/platform/growth/inbox/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: newLeadId,
        subject: newSubject.trim() || "New thread",
      }),
    })
    const payload = (await response.json()) as { message?: string; thread?: GrowthInboxThread }
    if (!response.ok) throw new Error(payload.message ?? "Could not create inbox thread.")
    if (payload.thread) setSelectedThreadId(payload.thread.id)
    setNewSubject("")
  }

  async function addMessage() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch("/api/platform/growth/inbox/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: selectedThread.id,
        direction: messageDirection,
        subject: selectedThread.subject,
        bodyPreview: messageBody.trim(),
      }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not add message.")
    setMessageBody("")
    await loadThreadDetail(selectedThread.id)
  }

  async function assignOwner() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThread.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not assign owner.")
  }

  async function resolveThread() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThread.id}/resolve`, {
      method: "POST",
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not resolve thread.")
  }

  async function archiveThread() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not archive thread.")
  }

  function renderSignalFlags(message: GrowthInboxMessage): string[] {
    const flags: string[] = []
    if (message.contains_budget) flags.push("Budget")
    if (message.contains_pricing) flags.push("Pricing")
    if (message.contains_meeting_language) flags.push("Meeting")
    if (message.contains_positive_signal) flags.push("Positive")
    if (message.contains_competitor) flags.push("Competitor")
    return flags
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading unified inbox…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER} · Manual ingestion and deterministic reply intelligence only — no mailbox sync or auto replies.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences/execution">Sequence Execution</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Inbox Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open" value={String(dashboard?.open_count ?? 0)} />
          <StatTile label="Needs Review" value={String(dashboard?.needs_review_count ?? 0)} />
          <StatTile label="Waiting" value={String(dashboard?.waiting_count ?? 0)} />
          <StatTile label="Critical Priority" value={String(dashboard?.critical_priority_count ?? 0)} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sync Health">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER} tone="neutral" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Last Sync" value={formatDate(syncDashboard?.lastSyncAt)} />
          <StatTile label="Imported 24h" value={String(syncDashboard?.imported24h ?? 0)} />
          <StatTile label="Duplicates Skipped" value={String(syncDashboard?.duplicatesSkipped24h ?? 0)} />
          <StatTile label="Failed Runs" value={String(syncDashboard?.failedRuns24h ?? 0)} />
          <StatTile label="Thread Match Rate" value={`${syncDashboard?.threadMatchRate ?? 0}%`} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sync Runs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Mailbox</th>
                <th className="px-2 py-2 font-medium">Provider</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Seen</th>
                <th className="px-2 py-2 font-medium">Imported</th>
                <th className="px-2 py-2 font-medium">Matched</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Duplicates</th>
                <th className="px-2 py-2 font-medium">Started</th>
                <th className="px-2 py-2 font-medium">Completed</th>
                <th className="px-2 py-2 font-medium">Failure</th>
              </tr>
            </thead>
            <tbody>
              {(syncDashboard?.runs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">
                    No sync runs yet. Run inbox sync from platform API or cron when mailboxes are connected.
                  </td>
                </tr>
              ) : (
                (syncDashboard?.runs ?? []).slice(0, 20).map((run) => (
                  <tr key={run.id} className="border-b">
                    <td className="px-2 py-2">{run.mailboxLabel}</td>
                    <td className="px-2 py-2">{run.providerFamily}</td>
                    <td className="px-2 py-2">{inboxSyncStatusLabel(run.status)}</td>
                    <td className="px-2 py-2">{run.messagesSeen}</td>
                    <td className="px-2 py-2">{run.messagesImported}</td>
                    <td className="px-2 py-2">{run.threadsMatched}</td>
                    <td className="px-2 py-2">{run.threadsCreated}</td>
                    <td className="px-2 py-2">{run.duplicatesSkipped}</td>
                    <td className="px-2 py-2">{formatDate(run.startedAt)}</td>
                    <td className="px-2 py-2">{formatDate(run.completedAt)}</td>
                    <td className="max-w-[160px] truncate px-2 py-2 text-destructive" title={run.failureReason ?? undefined}>
                      {run.failureReason ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider Mailbox Controls">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            Archive provider thread
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Mark read/unread provider thread
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Create Thread">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="inbox-lead">Lead</Label>
            <Select value={newLeadId} onValueChange={setNewLeadId}>
              <SelectTrigger id="inbox-lead">
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inbox-subject">Subject</Label>
            <Input id="inbox-subject" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="Re: follow-up" />
          </div>
          <Button
            type="button"
            disabled={!newLeadId || Boolean(actionLoading)}
            onClick={() => void runAction("create-thread", createThread)}
          >
            <Plus className="mr-1.5 size-3.5" />
            Create Thread
          </Button>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <GrowthEngineCard title="Threads">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Lead</th>
                  <th className="px-2 py-2 font-medium">Subject</th>
                  <th className="px-2 py-2 font-medium">Classification</th>
                  <th className="px-2 py-2 font-medium">Priority</th>
                  <th className="px-2 py-2 font-medium">Replies</th>
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Last Activity</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {threads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                      No inbox threads yet. Create a thread to begin reply intelligence tracking.
                    </td>
                  </tr>
                ) : (
                  threads.map((thread) => (
                    <tr
                      key={thread.id}
                      className={`cursor-pointer border-b hover:bg-muted/40 ${selectedThread?.id === thread.id ? "bg-muted/60" : ""}`}
                      onClick={() => {
                        setSelectedThreadId(thread.id)
                        void loadThreadDetail(thread.id)
                      }}
                    >
                      <td className="px-2 py-2">{thread.lead_label}</td>
                      <td className="px-2 py-2">{thread.subject || "—"}</td>
                      <td className="px-2 py-2">
                        <GrowthBadge label={classificationLabel(thread.classification)} tone={STATUS_TONE[thread.priority_tier] ?? "neutral"} />
                      </td>
                      <td className="px-2 py-2">
                        <GrowthBadge label={priorityTierLabel(thread.priority_tier)} tone={STATUS_TONE[thread.priority_tier] ?? "neutral"} />
                      </td>
                      <td className="px-2 py-2">{thread.reply_count}</td>
                      <td className="px-2 py-2">{thread.owner_label ?? "Unassigned"}</td>
                      <td className="px-2 py-2">{formatDate(thread.last_message_at)}</td>
                      <td className="px-2 py-2">
                        <GrowthBadge label={threadStatusLabel(thread.thread_status)} tone={STATUS_TONE[thread.thread_status] ?? "neutral"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Reply Intelligence">
          <div className="grid gap-2 sm:grid-cols-2">
            <StatTile label="Budget" value={String(intelligence?.budget ?? 0)} />
            <StatTile label="Timeline" value={String(intelligence?.timeline ?? 0)} />
            <StatTile label="Meeting intent" value={String(intelligence?.meeting_intent ?? 0)} />
            <StatTile label="Positive interest" value={String(intelligence?.positive_interest ?? 0)} />
            <StatTile label="Competitor mention" value={String(intelligence?.competitor ?? 0)} />
            <StatTile label="Unsubscribe" value={String(intelligence?.unsubscribe ?? 0)} />
          </div>
          <div className="mt-4 space-y-2">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                  <span className="text-sm font-medium">{event.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
              </div>
            ))}
            {events.length === 0 ? <p className="text-sm text-muted-foreground">No reply intelligence events yet.</p> : null}
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthInboxTeamQueuePanel
        selectedThreadId={selectedThread?.id ?? null}
        onSelectThread={(threadId) => {
          setSelectedThreadId(threadId)
          void loadThreadDetail(threadId)
        }}
        disabled={Boolean(actionLoading)}
      />

      {selectedThread ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <GrowthEngineCard title="Message Viewer">
            <div className="space-y-3">
              {selectedMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages on this thread yet.</p>
              ) : (
                selectedMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-border px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={message.direction} tone={message.direction === "inbound" ? "healthy" : "neutral"} />
                      <span className="text-xs text-muted-foreground">{formatDate(message.message_timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm">{message.body_preview || "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {renderSignalFlags(message).map((flag) => (
                        <GrowthBadge key={flag} label={flag} tone="attention" />
                      ))}
                      {renderSignalFlags(message).length === 0 ? (
                        <span className="text-xs text-muted-foreground">No signals detected</span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </GrowthEngineCard>

          <GrowthEngineCard title="Thread Actions">
            <div className="space-y-4">
              {syncDetail ? (
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                  <p className="font-medium">Thread continuity</p>
                  <dl className="mt-2 space-y-1 text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <dt>Provider thread id</dt>
                      <dd className="font-mono">{syncDetail.providerThreadId?.slice(0, 12) ?? "—"}…</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Matched by</dt>
                      <dd>{syncDetail.matchedBy ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Confidence</dt>
                      <dd>{syncDetail.confidence}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Linked sequence</dt>
                      <dd>{syncDetail.sequenceEnrollmentId ? syncDetail.sequenceEnrollmentId.slice(0, 8) : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Linked delivery attempt</dt>
                      <dd>{syncDetail.deliveryAttemptId ? syncDetail.deliveryAttemptId.slice(0, 8) : "—"}</dd>
                    </div>
                  </dl>
                  {syncDetail.sequenceExitCandidate ? (
                    <p className="mt-2 text-amber-800">Sequence exit review recommended — human approval required.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="message-direction">Direction</Label>
                <Select value={messageDirection} onValueChange={(value) => setMessageDirection(value as "inbound" | "outbound")}>
                  <SelectTrigger id="message-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message-body">Preview</Label>
                <Textarea
                  id="message-body"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Paste reply preview for deterministic classification…"
                  rows={4}
                />
              </div>
              <Button type="button" variant="outline" disabled={Boolean(actionLoading)} onClick={() => void runAction("add-message", addMessage)}>
                Add Message
              </Button>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="button" disabled={Boolean(actionLoading)} onClick={() => void runAction("assign", assignOwner)}>
                  Assign Owner
                </Button>
                <Button type="button" variant="outline" disabled={Boolean(actionLoading)} onClick={() => void runAction("resolve", resolveThread)}>
                  Resolve
                </Button>
                <Button type="button" variant="outline" disabled={Boolean(actionLoading)} onClick={() => void runAction("archive", archiveThread)}>
                  Archive
                </Button>
              </div>
            </div>
          </GrowthEngineCard>
          </div>

          <GrowthReplyDraftingPanel threadId={selectedThread.id} disabled={Boolean(actionLoading)} />

          <GrowthInboxOpportunityIntelligencePanel
            leadId={selectedThread.lead_id}
            threadId={selectedThread.id}
            disabled={Boolean(actionLoading)}
          />
        </>
      ) : null}
    </div>
  )
}
