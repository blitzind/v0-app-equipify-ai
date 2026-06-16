"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementAlertCard } from "@/components/growth/engagement/growth-engagement-alert-card"
import { GrowthEngagementTimelineItem } from "@/components/growth/engagement/growth-engagement-timeline-item"
import type { GrowthEngagementDrilldownTarget } from "@/components/growth/engagement/growth-engagement-drilldown-drawer"
import type {
  GrowthEngagementCommandCenterFeedItem,
  GrowthEngagementCommandCenterFeedSection,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementAlert } from "@/lib/growth/engagement/growth-engagement-alert-types"

function timelineEventFromFeedItem(item: GrowthEngagementCommandCenterFeedItem): GrowthEngagementTimelineEvent | null {
  if (item.kind !== "timeline") return null
  return {
    eventId: item.feedId.replace("timeline:", ""),
    eventType: (item.metadata?.eventType as GrowthEngagementTimelineEvent["eventType"]) ?? "share_page_viewed",
    occurredAt: item.occurredAt,
    leadId: (item.metadata?.leadId as string | null) ?? null,
    sharePageId: (item.metadata?.sharePageId as string | null) ?? null,
    templateId: (item.metadata?.templateId as string | null) ?? null,
    mediaAssetId: (item.metadata?.mediaAssetId as string | null) ?? null,
    ctaKey: null,
    sessionId: null,
    title: item.title,
    description: item.description,
    metadata: item.metadata ?? {},
    source: "share_page_event",
  }
}

function alertFromFeedItem(item: GrowthEngagementCommandCenterFeedItem): GrowthEngagementAlert | null {
  if (item.kind !== "alert" && item.kind !== "high_intent") return null
  if (!item.entityType || !item.entityId) return null
  return {
    alertId: item.feedId.replace(/^(alert|high_intent):/, ""),
    watchlistId: null,
    alertType: (item.metadata?.alertType as GrowthEngagementAlert["alertType"]) ?? "high_intent_detected",
    title: item.title,
    description: item.description,
    severity: item.severity ?? "medium",
    entityType: item.entityType,
    entityId: item.entityId,
    occurredAt: item.occurredAt,
    metadata: item.metadata ?? {},
    source: item.kind === "high_intent" ? "high_intent_signal" : "timeline_event",
    acknowledged: false,
  }
}

export function GrowthEngagementCommandCenterFeed({
  feed,
  loading,
  loadingMore,
  onLoadMore,
  onOpenDrilldown,
}: {
  feed: GrowthEngagementCommandCenterFeedSection | null
  loading: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  onOpenDrilldown?: (target: GrowthEngagementDrilldownTarget) => void
}) {
  return (
    <GrowthEngineCard title="Unified activity feed">
      {loading && !feed ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading feed…
        </div>
      ) : null}

      {!loading && feed && feed.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feed items match the current filters.</p>
      ) : null}

      {feed ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Showing {feed.items.length} of {feed.total}
          </p>
          <ul className="space-y-2">
            {feed.items.map((item) => {
              if (item.kind === "timeline") {
                const event = timelineEventFromFeedItem(item)
                return event ? (
                  <li key={item.feedId}>
                    <GrowthEngagementTimelineItem
                      event={event}
                      onOpen={
                        onOpenDrilldown
                          ? (timelineEvent) => {
                              if (timelineEvent.leadId) onOpenDrilldown({ kind: "lead", id: timelineEvent.leadId })
                              else if (timelineEvent.templateId) onOpenDrilldown({ kind: "template", id: timelineEvent.templateId })
                              else if (timelineEvent.mediaAssetId) onOpenDrilldown({ kind: "media", id: timelineEvent.mediaAssetId })
                              else if (timelineEvent.sharePageId) onOpenDrilldown({ kind: "share_page", id: timelineEvent.sharePageId })
                            }
                          : undefined
                      }
                    />
                  </li>
                ) : null
              }

              if (item.kind === "report") {
                return (
                  <li key={item.feedId} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                      <GrowthBadge label="Report" tone="neutral" />
                    </div>
                  </li>
                )
              }

              const alert = alertFromFeedItem(item)
              return alert ? (
                <GrowthEngagementAlertCard key={item.feedId} alert={alert} onOpenDrilldown={onOpenDrilldown} />
              ) : null
            })}
          </ul>

          {feed.nextCursor && onLoadMore ? (
            <Button size="sm" variant="outline" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}
