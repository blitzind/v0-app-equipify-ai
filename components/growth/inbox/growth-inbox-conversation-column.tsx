"use client"

import { GrowthInboxConversationThreadOps } from "@/components/growth/inbox/growth-inbox-conversation-thread-ops"
import { GrowthInboxInlineRevenueContext } from "@/components/growth/inbox/growth-inbox-inline-revenue-context"
import { GrowthInboxRelationshipMemoryStrip } from "@/components/growth/inbox/growth-inbox-relationship-memory-strip"
import { GrowthInboxRelationshipTimeline } from "@/components/growth/inbox/growth-inbox-relationship-timeline"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  INBOX_STATUS_TONE,
  displayInboxLeadLabel,
  displayInboxSubject,
  formatInboxDate,
  inboxMessageSignalFlags,
  normalizeInboxDisplayText,
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
    <div
      className="flex h-full min-h-0 flex-col bg-card"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <header className="shrink-0 border-b border-border px-4 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Conversation</p>
        <h2 className="mt-0.5 text-base font-semibold leading-snug">{displayInboxSubject(selectedThread.subject)}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
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
          <span className="text-[10px] text-muted-foreground">
            {selectedThread.owner_label ?? "Unassigned"} · {formatInboxDate(selectedThread.last_message_at)}
          </span>
        </div>
      </header>

      <GrowthInboxRelationshipMemoryStrip />
      <GrowthInboxInlineRevenueContext />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2.5 p-3">
          {selectedMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages on this thread yet.</p>
          ) : (
            selectedMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={message.direction} tone={message.direction === "inbound" ? "healthy" : "neutral"} />
                  <span className="text-[10px] text-muted-foreground">{formatInboxDate(message.message_timestamp)}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  {normalizeInboxDisplayText(message.body_preview) || "—"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {inboxMessageSignalFlags(message).map((flag) => (
                    <GrowthBadge key={flag} label={flag} tone="attention" />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <GrowthInboxRelationshipTimeline />

      {syncDetail?.sequenceExitCandidate ? (
        <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
          Sequence exit review recommended — human approval required.
        </div>
      ) : null}

      <GrowthInboxConversationThreadOps />
    </div>
  )
}
