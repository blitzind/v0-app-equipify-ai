"use client"

import { GrowthInboxConversationThreadOps } from "@/components/growth/inbox/growth-inbox-conversation-thread-ops"
import { GrowthInboxInlineRevenueContext } from "@/components/growth/inbox/growth-inbox-inline-revenue-context"
import { GrowthInboxRelationshipMemoryStrip } from "@/components/growth/inbox/growth-inbox-relationship-memory-strip"
import { GrowthInboxRelationshipTimeline } from "@/components/growth/inbox/growth-inbox-relationship-timeline"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  INBOX_STATUS_TONE,
  displayInboxLeadLabel,
  formatInboxDate,
  inboxMessageSignalFlags,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import { priorityTierLabel } from "@/lib/growth/inbox/thread-priority"
import { threadStatusLabel } from "@/lib/growth/inbox/thread-health"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

export function GrowthInboxConversationColumn() {
  const { selectedThread, selectedMessages, syncDetail } = useGrowthInboxWorkspace()

  if (!selectedThread) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Select a thread to view the conversation.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-card" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}>
      <header className="border-b border-border bg-card px-4 py-3 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversation</p>
        <h2 className="mt-1 text-lg font-semibold">{selectedThread.subject || "Untitled thread"}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{displayInboxLeadLabel(selectedThread)}</span>
          <GrowthBadge
            label={classificationLabel(selectedThread.classification)}
            tone={INBOX_STATUS_TONE[selectedThread.priority_tier] ?? "neutral"}
          />
          <GrowthBadge
            label={priorityTierLabel(selectedThread.priority_tier)}
            tone={INBOX_STATUS_TONE[selectedThread.priority_tier] ?? "neutral"}
          />
          <GrowthBadge
            label={threadStatusLabel(selectedThread.thread_status)}
            tone={INBOX_STATUS_TONE[selectedThread.thread_status] ?? "neutral"}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Owner {selectedThread.owner_label ?? "Unassigned"} · Last activity {formatInboxDate(selectedThread.last_message_at)}
        </p>
      </header>

      <GrowthInboxRelationshipMemoryStrip />
      <GrowthInboxInlineRevenueContext />

      <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-muted/10 to-card">
        <div className="border-b border-border/80 bg-card/95 shadow-sm">
          <GrowthInboxRelationshipTimeline />
        </div>

        <div className="space-y-3 p-4">
          {selectedMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages on this thread yet.</p>
          ) : (
            selectedMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={message.direction} tone={message.direction === "inbound" ? "healthy" : "neutral"} />
                  <span className="text-xs text-muted-foreground">{formatInboxDate(message.message_timestamp)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{message.body_preview || "—"}</p>
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
      </div>

      {syncDetail?.sequenceExitCandidate ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Sequence exit review recommended — human approval required.
        </div>
      ) : null}

      <GrowthInboxConversationThreadOps />
    </div>
  )
}
