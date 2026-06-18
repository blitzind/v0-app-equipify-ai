"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Activity, ExternalLink, Loader2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { subscribeToGrowthRealtimeEvents, type GrowthRealtimeSubscriptionMode } from "@/lib/growth/realtime-events/realtime-events-subscriber"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"
import {
  REALTIME_EVENT_FILTERS,
  REALTIME_EVENTS_QA_MARKER,
  type GrowthRealtimeEvent,
  type GrowthRealtimeEventsResponse,
  type RealtimeEventFilter,
} from "@/lib/growth/realtime-events/realtime-events-types"

function deliveryTone(status: GrowthRealtimeEvent["delivery_status"]) {
  switch (status) {
    case "failed":
      return "critical" as const
    case "pending":
      return "attention" as const
    case "routed":
    case "delivered":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

export function GrowthRealtimeEventBusPanel({
  title = "Real-Time Event Bus",
  compact = false,
  useInboxConcurrencyLimit = false,
  enableSubscription = true,
  loadOnMount = true,
}: {
  title?: string
  compact?: boolean
  useInboxConcurrencyLimit?: boolean
  enableSubscription?: boolean
  loadOnMount?: boolean
}) {
  const [filter, setFilter] = useState<RealtimeEventFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [feed, setFeed] = useState<GrowthRealtimeEventsResponse | null>(null)
  const [subscriptionMode, setSubscriptionMode] = useState<GrowthRealtimeSubscriptionMode>("polling")
  const subscriptionRef = useRef<ReturnType<typeof subscribeToGrowthRealtimeEvents> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("filter", filter)
      params.set("limit", compact ? "8" : "25")
      const res = await fetchPlatformGrowthClient(`/api/platform/growth/realtime-events?${params.toString()}`, {
        useInboxConcurrencyLimit,
      })
      const data = (await res.json()) as GrowthRealtimeEventsResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Realtime events request failed")
        setFeed(null)
        return
      }
      setFeed(data)
    } catch {
      setError("Realtime events unavailable")
      setFeed(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, useInboxConcurrencyLimit])

  useEffect(() => {
    if (!loadOnMount) return
    void load()
  }, [load, loadOnMount])

  useEffect(() => {
    if (!enableSubscription) return
    subscriptionRef.current?.unsubscribe()
    subscriptionRef.current = subscribeToGrowthRealtimeEvents({
      limit: compact ? 8 : 25,
      onEvents: (events, mode) => {
        setSubscriptionMode(mode)
        setFeed((prev) =>
          prev
            ? { ...prev, events, total: events.length, subscription_mode: mode }
            : {
                qa_marker: REALTIME_EVENTS_QA_MARKER,
                generated_at: new Date().toISOString(),
                total: events.length,
                routed_count: events.filter((e) => e.delivery_status === "routed").length,
                pending_count: events.filter((e) => e.delivery_status === "pending").length,
                subscription_mode: mode,
                events,
                requires_human_review: true,
                autonomous_execution_enabled: false,
              },
        )
      },
    })
    return () => subscriptionRef.current?.unsubscribe()
  }, [compact, enableSubscription])

  async function runAction(event: GrowthRealtimeEvent, action: "mark_reviewed" | "dismiss") {
    setActingId(event.event_id)
    try {
      await fetch("/api/platform/growth/realtime-events/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, event }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  async function viewEvent(event: GrowthRealtimeEvent) {
    setExpandedId(event.event_id)
    await fetch("/api/platform/growth/realtime-events/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view_details", event }),
    }).catch(() => null)
  }

  return (
    <GrowthEngineCard
      title={title}
      icon={<Radio className="h-4 w-4" />}
      data-qa-marker={REALTIME_EVENTS_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Growth engine event plumbing — publish, route, and UI refresh signals via growth.signal_events. Observability
        only. No outreach, enrollment, or autonomous execution.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GrowthBadge tone={subscriptionMode === "realtime" ? "healthy" : "attention"}>
          {subscriptionMode === "realtime" ? "Realtime connected" : subscriptionMode === "polling" ? "Polling fallback" : "Unavailable"}
        </GrowthBadge>
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">UI refresh signals</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {REALTIME_EVENT_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {value.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh events
      </Button>

      {feed ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{feed.total} events</GrowthBadge>
          <GrowthBadge tone="healthy">{feed.routed_count} routed</GrowthBadge>
          <GrowthBadge tone="attention">{feed.pending_count} pending</GrowthBadge>
        </div>
      ) : null}

      <GrowthEnginePanelResilience
        loading={loading && !feed}
        error={error}
        isEmpty={!loading && (feed?.events.length ?? 0) === 0}
        emptyKind="no_events"
        onRetry={() => void load()}
        partialData={Boolean(feed)}
      >
        {feed?.events.map((event) => (
          <div key={event.event_id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.source.replace(/_/g, " ")} · {event.event_type}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={deliveryTone(event.delivery_status)}>{event.delivery_status}</GrowthBadge>
                <GrowthBadge tone="neutral">{event.review_status}</GrowthBadge>
              </div>
            </div>

            <p className="mb-2 text-sm text-muted-foreground">{event.description}</p>

            {expandedId === event.event_id ? (
              <div className="mb-3 space-y-2 text-xs">
                {event.routes.length > 0 ? (
                  <div>
                    <p className="font-medium">Routes</p>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {event.routes.map((route) => (
                        <li key={route.route_id}>
                          {route.subscriber.replace(/_/g, " ")} — {route.refresh_hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {event.related_entity_type ? (
                  <p className="text-muted-foreground">
                    Related: {event.related_entity_type} {event.related_entity_id ?? ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mb-2 flex flex-wrap gap-2">
                {event.routes.slice(0, compact ? 2 : 4).map((route) => (
                  <GrowthBadge key={route.route_id} tone="neutral">
                    {route.subscriber.replace(/_/g, " ")}
                  </GrowthBadge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void viewEvent(event)}>
                View Event
              </Button>
              {event.related_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={event.related_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open Related
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === event.event_id}
                onClick={() => void runAction(event, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === event.event_id}
                onClick={() => void runAction(event, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </GrowthEnginePanelResilience>
    </GrowthEngineCard>
  )
}
