"use client"

import { Mail, MessageSquare } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  displayInboxLeadLabel,
  displayInboxSubject,
  INBOX_STATUS_TONE,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { inboxThreadNeedsAttention } from "@/lib/growth/inbox/inbox-channel-types"
import {
  formatInboxCompactTimestamp,
  inboxContactInitials,
  parseInboxLeadLabelParts,
  resolveInboxStatusBadgeLabels,
} from "@/lib/growth/inbox/inbox-message-display-utils"
import { cn } from "@/lib/utils"

export const GROWTH_INBOX_THREAD_QUEUE_ROW_QA_MARKER = "growth-inbox-thread-queue-row-v2" as const

type GrowthInboxThreadQueueRowProps = {
  thread: GrowthInboxThread
  selected: boolean
  onSelect: () => void
}

export function GrowthInboxThreadQueueRow({ thread, selected, onSelect }: GrowthInboxThreadQueueRowProps) {
  const { company, contact } = parseInboxLeadLabelParts(thread.lead_label)
  const statusLabels = resolveInboxStatusBadgeLabels(thread)
  const preview = displayInboxSubject(thread.subject)
  const needsAttention = inboxThreadNeedsAttention(thread)

  return (
    <button
      type="button"
      className={cn(
        "group flex w-full max-h-[88px] min-h-[72px] gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 max-lg:min-h-[76px]",
        selected
          ? "border-primary/50 bg-primary/10 shadow-sm"
          : "border-border/60 bg-card hover:border-border hover:bg-muted/40",
      )}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      aria-label={`${displayInboxLeadLabel(thread)} — ${preview}`}
      data-thread-id={thread.id}
      data-qa-marker={GROWTH_INBOX_THREAD_QUEUE_ROW_QA_MARKER}
    >
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
          needsAttention ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {needsAttention ? "●" : inboxContactInitials(thread.lead_label).slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-semibold text-foreground">{contact}</span>
          {thread.channel === "sms" ? (
            <MessageSquare className="size-3 shrink-0 text-muted-foreground" aria-label="SMS" />
          ) : (
            <Mail className="size-3 shrink-0 text-muted-foreground" aria-label="Email" />
          )}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">{company}</span>
        <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">{preview}</span>
        <span className="mt-0.5 flex items-center justify-between gap-1">
          <span className="flex min-w-0 items-center gap-1 overflow-hidden">
            {statusLabels.map((label) => (
              <GrowthBadge
                key={label}
                label={label}
                tone={INBOX_STATUS_TONE[thread.priority_tier] ?? "neutral"}
              />
            ))}
          </span>
          <time
            className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
            dateTime={thread.last_message_at ?? undefined}
          >
            {formatInboxCompactTimestamp(thread.last_message_at)}
          </time>
        </span>
      </span>
    </button>
  )
}
