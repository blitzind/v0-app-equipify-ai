"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function GrowthEngagementTimelineItem({
  event,
  onOpen,
}: {
  event: GrowthEngagementTimelineEvent
  onOpen?: (event: GrowthEngagementTimelineEvent) => void
}) {
  const clickable = Boolean(onOpen)

  return (
    <button
      type="button"
      className={`w-full rounded-lg border border-border px-3 py-2 text-left text-sm ${clickable ? "transition hover:bg-muted/40" : ""}`}
      onClick={() => onOpen?.(event)}
      disabled={!clickable}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{event.title}</p>
          <p className="text-muted-foreground">{event.description}</p>
        </div>
        <GrowthBadge label={event.eventType.replaceAll("_", " ")} tone="neutral" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{formatWhen(event.occurredAt)}</span>
        {event.leadId ? <span>lead {event.leadId.slice(0, 8)}…</span> : null}
        {event.templateId ? <span>template {event.templateId.slice(0, 8)}…</span> : null}
        {event.mediaAssetId ? <span>media {event.mediaAssetId.slice(0, 8)}…</span> : null}
        {event.sharePageId ? <span>page {event.sharePageId.slice(0, 8)}…</span> : null}
        {event.ctaKey ? <span>cta {event.ctaKey}</span> : null}
      </div>
    </button>
  )
}
