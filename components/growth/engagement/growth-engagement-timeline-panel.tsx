"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementTimelineItem } from "@/components/growth/engagement/growth-engagement-timeline-item"
import {
  GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES,
  type GrowthEngagementTimelineEvent,
  type GrowthEngagementTimelineEventType,
  type GrowthEngagementTimelineResponse,
} from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

type TimelineApiResponse = {
  ok?: boolean
  timeline?: GrowthEngagementTimelineResponse
  message?: string
}

export function GrowthEngagementTimelinePanel({
  dateRange,
  leadId,
  templateId,
  mediaAssetId,
  onOpenEvent,
}: {
  dateRange: GrowthEngagementDashboardDateRangePreset
  leadId?: string
  templateId?: string
  mediaAssetId?: string
  onOpenEvent?: (event: GrowthEngagementTimelineEvent) => void
}) {
  const [eventType, setEventType] = useState<GrowthEngagementTimelineEventType | null>(null)
  const [items, setItems] = useState<GrowthEngagementTimelineEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [sourceAvailability, setSourceAvailability] = useState<GrowthEngagementTimelineResponse["sourceAvailability"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseQuery = useMemo(() => {
    const params = new URLSearchParams({ dateRange, limit: "50" })
    if (leadId?.trim()) params.set("leadId", leadId.trim())
    if (templateId?.trim()) params.set("templateId", templateId.trim())
    if (mediaAssetId?.trim()) params.set("mediaAssetId", mediaAssetId.trim())
    if (eventType) params.set("eventType", eventType)
    return params.toString()
  }, [dateRange, leadId, templateId, mediaAssetId, eventType])

  const loadTimeline = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }

      try {
        const params = new URLSearchParams(baseQuery)
        if (cursor) params.set("cursor", cursor)
        const res = await fetch(`/api/platform/growth/engagement-dashboard/timeline?${params.toString()}`, {
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as TimelineApiResponse
        if (!res.ok || !data.ok || !data.timeline) {
          throw new Error(data.message ?? "Could not load engagement timeline.")
        }

        setSourceAvailability(data.timeline.sourceAvailability)
        setNextCursor(data.timeline.timeline.nextCursor)
        setItems((current) => (append ? [...current, ...data.timeline!.timeline.items] : data.timeline!.timeline.items))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load engagement timeline.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [baseQuery],
  )

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  const unavailableSources = sourceAvailability
    ? Object.entries(sourceAvailability).filter(([, value]) => !value.source_available)
    : []

  return (
    <GrowthEngineCard title="Engagement timeline">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label="Read-only timeline" tone="neutral" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={eventType == null ? "default" : "outline"} onClick={() => setEventType(null)}>
            All events
          </Button>
          {GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES.slice(0, 6).map((type) => (
            <Button
              key={type}
              size="sm"
              variant={eventType === type ? "default" : "outline"}
              onClick={() => setEventType(type)}
            >
              {type.replaceAll("_", " ")}
            </Button>
          ))}
        </div>

        {unavailableSources.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              Timeline sources partially unavailable
            </div>
            <ul className="list-disc pl-5">
              {unavailableSources.map(([key, value]) => (
                <li key={key}>
                  {key}: {value.message ?? "Not queryable"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading timeline…
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No engagement timeline events for the selected filters.</p>
        ) : null}

        <ul className="space-y-2">
          {items.map((event) => (
            <li key={event.eventId}>
              <GrowthEngagementTimelineItem event={event} onOpen={onOpenEvent} />
            </li>
          ))}
        </ul>

        {nextCursor ? (
          <Button size="sm" variant="outline" disabled={loadingMore} onClick={() => void loadTimeline(nextCursor, true)}>
            {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more
          </Button>
        ) : null}
      </div>
    </GrowthEngineCard>
  )
}
