"use client"

import Link from "next/link"
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
import { GrowthInboxDiagnosticsPanel } from "@/components/growth/inbox/growth-inbox-diagnostics-panel"
import { GrowthInboxExtendedPanels } from "@/components/growth/inbox/growth-inbox-extended-panels"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  INBOX_STATUS_TONE,
  displayInboxLeadLabel,
  formatInboxDate,
  inboxMessageSignalFlags,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import { GrowthInboxSetupEmptyState } from "@/components/growth/growth-inbox-setup-empty-state"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import { priorityTierLabel } from "@/lib/growth/inbox/thread-priority"
import { threadStatusLabel } from "@/lib/growth/inbox/thread-health"
import { GROWTH_INBOX_DIAGNOSTICS_HREF } from "@/lib/growth/inbox/inbox-workspace-types"
import { GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER } from "@/lib/growth/inbox/inbox-runtime-types"
import { GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER } from "@/lib/growth/inbox/inbox-types"

export function GrowthUnifiedInboxDashboardPanel() {
  const {
    loading,
    error,
    actionLoading,
    threads,
    selectedThread,
    selectedMessages,
    syncDetail,
    showHonestEmptyState,
    setupPhase,
    leads,
    newLeadId,
    newSubject,
    messageBody,
    messageDirection,
    setNewLeadId,
    setNewSubject,
    setMessageBody,
    setMessageDirection,
    setSelectedThreadId,
    load,
    loadThreadDetail,
    runAction,
    createThread,
    addMessage,
    assignOwner,
    resolveThread,
    archiveThread,
  } = useGrowthInboxWorkspace()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading unified inbox…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-equipify-qa-marker={GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER} · {GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER} · Manual ingestion and deterministic reply intelligence only — no auto replies.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={GROWTH_INBOX_DIAGNOSTICS_HREF}>Inbox Diagnostics</Link>
          </Button>
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

      {showHonestEmptyState ? <GrowthInboxSetupEmptyState phase={setupPhase} /> : null}

      <GrowthInboxDiagnosticsPanel hideWhenEmpty showHonestEmptyState={showHonestEmptyState} />

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
                    <td className="px-2 py-2">{displayInboxLeadLabel(thread)}</td>
                    <td className="px-2 py-2">{thread.subject || "—"}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={classificationLabel(thread.classification)} tone={INBOX_STATUS_TONE[thread.priority_tier] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={priorityTierLabel(thread.priority_tier)} tone={INBOX_STATUS_TONE[thread.priority_tier] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-2">{thread.reply_count}</td>
                    <td className="px-2 py-2">{thread.owner_label ?? "Unassigned"}</td>
                    <td className="px-2 py-2">{formatInboxDate(thread.last_message_at)}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={threadStatusLabel(thread.thread_status)} tone={INBOX_STATUS_TONE[thread.thread_status] ?? "neutral"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      {selectedThread ? (
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
                      <span className="text-xs text-muted-foreground">{formatInboxDate(message.message_timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm">{message.body_preview || "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {inboxMessageSignalFlags(message).map((flag) => (
                        <GrowthBadge key={flag} label={flag} tone="attention" />
                      ))}
                      {inboxMessageSignalFlags(message).length === 0 ? (
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
      ) : null}

      <GrowthInboxExtendedPanels />
    </div>
  )
}
