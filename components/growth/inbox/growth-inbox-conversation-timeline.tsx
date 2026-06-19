"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  formatInboxMessageDayHeader,
  prepareInboxMessageSnippet,
  splitInboxMessageSections,
} from "@/lib/growth/inbox/inbox-message-display-utils"
import {
  inboxMessageSignalFlags,
  normalizeInboxDisplayText,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import { cn } from "@/lib/utils"

export const GROWTH_INBOX_CONVERSATION_TIMELINE_QA_MARKER = "growth-inbox-conversation-timeline-v2" as const

function GrowthInboxTimelineMessage({ messageId, direction, timestamp, bodyPreview }: {
  messageId: string
  direction: "inbound" | "outbound"
  timestamp: string
  bodyPreview: string
}) {
  const [expandedBody, setExpandedBody] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [showQuoted, setShowQuoted] = useState(false)
  const [showForwarded, setShowForwarded] = useState(false)

  const normalized = normalizeInboxDisplayText(bodyPreview)
  const sections = splitInboxMessageSections(normalized)
  const { snippet, truncated } = prepareInboxMessageSnippet(normalized, 140)
  const displayBody = expandedBody ? sections.primary : snippet
  const directionLabel = direction.toUpperCase()

  return (
    <li className="list-none">
      <article
        className={cn(
          "rounded border px-2 py-1",
          direction === "inbound" ? "border-border/60 bg-muted/15" : "border-border/40 bg-background",
        )}
        aria-label={`${direction} message`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <GrowthBadge label={directionLabel} tone={direction === "inbound" ? "healthy" : "neutral"} />
          <span className="text-[10px] text-muted-foreground" aria-hidden>
            •
          </span>
          <time className="text-[10px] tabular-nums text-muted-foreground" dateTime={timestamp}>
            {formatInboxMessageDayHeader(timestamp)}
          </time>
        </div>
        <p
          id={`message-body-${messageId}`}
          className="mt-0.5 whitespace-pre-wrap text-xs leading-snug text-foreground"
        >
          {displayBody}
        </p>
        {truncated && !expandedBody ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-5 px-0 text-[10px]"
            onClick={() => setExpandedBody(true)}
            aria-expanded={false}
            aria-controls={`message-body-${messageId}`}
          >
            Show full message
          </Button>
        ) : null}
        {sections.quoted ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-5 px-0 text-[10px]"
            onClick={() => setShowQuoted((value) => !value)}
            aria-expanded={showQuoted}
          >
            {showQuoted ? "Hide previous messages" : "Show previous messages"}
          </Button>
        ) : null}
        {showQuoted && sections.quoted ? (
          <p className="mt-0.5 whitespace-pre-wrap border-l-2 border-border/60 pl-2 text-[10px] leading-snug text-muted-foreground">
            {sections.quoted}
          </p>
        ) : null}
        {sections.signature ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-5 px-0 text-[10px]"
            onClick={() => setShowSignature((value) => !value)}
            aria-expanded={showSignature}
          >
            {showSignature ? "Hide signature" : "Show signature"}
          </Button>
        ) : null}
        {showSignature && sections.signature ? (
          <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-snug text-muted-foreground">{sections.signature}</p>
        ) : null}
        {sections.forwarded ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-5 px-0 text-[10px]"
            onClick={() => setShowForwarded((value) => !value)}
            aria-expanded={showForwarded}
          >
            {showForwarded ? "Hide forwarded history" : "Show forwarded history"}
          </Button>
        ) : null}
        {showForwarded && sections.forwarded ? (
          <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-snug text-muted-foreground">{sections.forwarded}</p>
        ) : null}
      </article>
    </li>
  )
}

export function GrowthInboxConversationTimeline() {
  const { selectedThread, selectedMessages } = useGrowthInboxWorkspace()

  if (!selectedThread) return null

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      data-qa-marker={GROWTH_INBOX_CONVERSATION_TIMELINE_QA_MARKER}
    >
      <ol className="space-y-1 p-1.5" aria-label="Conversation messages">
        {selectedMessages.length === 0 ? (
          <li className="list-none px-1 py-3 text-center text-xs text-muted-foreground">
            No messages on this thread yet — sync or reply to start the thread.
          </li>
        ) : (
          selectedMessages.map((message) => (
            <div key={message.id}>
              <GrowthInboxTimelineMessage
                messageId={message.id}
                direction={message.direction}
                timestamp={message.message_timestamp}
                bodyPreview={message.body_preview}
              />
              {message.direction === "inbound" && inboxMessageSignalFlags(message).length > 0 ? (
                <div className="mt-0.5 flex flex-wrap gap-0.5 px-0.5">
                  {inboxMessageSignalFlags(message).map((flag) => (
                    <GrowthBadge key={`${message.id}-${flag}`} label={flag} tone="attention" />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </ol>
    </div>
  )
}
