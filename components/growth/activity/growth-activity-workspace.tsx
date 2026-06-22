"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, RefreshCw, Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthActivityEventCard } from "@/components/growth/activity/growth-activity-event-card"
import { GrowthActivityHighIntentRail } from "@/components/growth/activity/growth-activity-high-intent-rail"
import {
  GrowthActivityFeedSkeleton,
  GrowthActivityMetricsSkeleton,
  GrowthActivityRailSkeleton,
} from "@/components/growth/activity/growth-activity-skeleton"
import { StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_ACTIVITY_FILTER_OPTIONS,
  GROWTH_ACTIVITY_UNIFIED_API_PATH,
  GROWTH_ACTIVITY_WORKSPACE_QA_MARKER,
} from "@/lib/growth/activity/growth-activity-workspace-constants"
import {
  filterGrowthActivityEvents,
  searchGrowthActivityEvents,
} from "@/lib/growth/activity/growth-activity-workspace-filters"
import type {
  GrowthActivityEventView,
  GrowthActivityFilterId,
  GrowthActivityMetricsView,
  GrowthActivityRailQueueId,
  GrowthActivityRailQueues,
} from "@/lib/growth/activity/growth-activity-workspace-types"
import {
  buildGrowthActivityWorkspaceHref,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
  readGrowthActivityUrlState,
} from "@/lib/growth/navigation/growth-workspace-url-state-7a1"
import {
  buildGrowthActivityRailQueues,
  computeGrowthActivityMetrics,
} from "@/lib/growth/activity/growth-activity-workspace-view-model"
import { GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import type { GrowthSendrAnalyticsDateRangePreset } from "@/lib/growth/sendr/growth-sendr-types"

type UnifiedFeedResponse = {
  ok: boolean
  events?: GrowthActivityEventView[]
  railQueues?: GrowthActivityRailQueues
  message?: string
}

const EMPTY_RAIL_QUEUES: GrowthActivityRailQueues = {
  "needs-attention": [],
  "hot-prospects": [],
  "meetings-ready": [],
  "stalled-opportunities": [],
}

const EMPTY_METRICS: GrowthActivityMetricsView = {
  today: 0,
  thisWeek: 0,
  needsAttention: 0,
  highIntent: 0,
  meetingsBooked: 0,
  personalizationsGenerated: 0,
  callsCompleted: 0,
}

function buildQuery(dateRange: GrowthSendrAnalyticsDateRangePreset): string {
  return new URLSearchParams({ dateRange, limit: "200" }).toString()
}

export function GrowthActivityWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hydratingFromUrlRef = useRef(false)
  const lastPushedStateRef = useRef("")

  const [dateRange, setDateRange] = useState<GrowthSendrAnalyticsDateRangePreset>(
    GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET,
  )
  const [filterId, setFilterId] = useState<GrowthActivityFilterId>("all")
  const [search, setSearch] = useState("")
  const [focusedRailQueue, setFocusedRailQueue] = useState<GrowthActivityRailQueueId | null>(null)
  const [events, setEvents] = useState<GrowthActivityEventView[]>([])
  const [railQueues, setRailQueues] = useState<GrowthActivityRailQueues>(EMPTY_RAIL_QUEUES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next = readGrowthActivityUrlState(searchParams)
    const key = `${next.filterId}|${next.search}|${next.range}|${next.railQueue ?? ""}`
    if (lastPushedStateRef.current === key) return
    hydratingFromUrlRef.current = true
    setFilterId(next.filterId)
    setSearch(next.search)
    setDateRange(next.range)
    setFocusedRailQueue(next.railQueue)
    hydratingFromUrlRef.current = false
  }, [searchParams])

  useEffect(() => {
    if (hydratingFromUrlRef.current) return
    const key = `${filterId}|${search}|${dateRange}|${focusedRailQueue ?? ""}`
    if (lastPushedStateRef.current === key) return
    const href = buildGrowthActivityWorkspaceHref({
      filter: filterId,
      search,
      range: dateRange,
      rail: focusedRailQueue,
    })
    lastPushedStateRef.current = key
    router.replace(href, { scroll: false })
  }, [dateRange, filterId, focusedRailQueue, router, search])

  const selectFilter = useCallback((nextFilterId: GrowthActivityFilterId) => {
    setFilterId(nextFilterId)
  }, [])

  const selectRailQueue = useCallback((queueId: GrowthActivityRailQueueId | null) => {
    setFocusedRailQueue(queueId)
  }, [])

  const query = useMemo(() => buildQuery(dateRange), [dateRange])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${GROWTH_ACTIVITY_UNIFIED_API_PATH}?${query}`, { cache: "no-store" })
      const data = (await response.json()) as UnifiedFeedResponse
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Activity center unavailable")
        setEvents([])
        setRailQueues(EMPTY_RAIL_QUEUES)
        return
      }

      const nextEvents = data.events ?? []
      setEvents(nextEvents)
      setRailQueues(
        data.railQueues ??
          buildGrowthActivityRailQueues({
            sendrProspects: [],
            signalHot: [],
            events: nextEvents,
          }),
      )
    } catch {
      setError("Activity center unavailable")
      setEvents([])
      setRailQueues(EMPTY_RAIL_QUEUES)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const metrics = useMemo(() => computeGrowthActivityMetrics(events), [events])

  const filteredEvents = useMemo(() => {
    const filtered = filterGrowthActivityEvents(events, filterId)
    return searchGrowthActivityEvents(filtered, search)
  }, [events, filterId, search])

  const displayMetrics = loading && events.length === 0 ? EMPTY_METRICS : metrics

  return (
    <div className="space-y-6" data-qa={GROWTH_ACTIVITY_WORKSPACE_QA_MARKER} data-growth-ops-url-state={GROWTH_OPS_URL_STATE_7A1_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cross-workspace command feed — communication, personalization, sales, intelligence, and content in one timeline.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lead, company, event…"
              className="pl-8"
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as GrowthSendrAnalyticsDateRangePreset)}
          >
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading && events.length === 0 ? (
        <GrowthActivityMetricsSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatTile label="Today" value={displayMetrics.today} />
          <StatTile label="This Week" value={displayMetrics.thisWeek} />
          <StatTile label="Needs Attention" value={displayMetrics.needsAttention} />
          <StatTile label="High Intent" value={displayMetrics.highIntent} />
          <StatTile label="Meetings Booked" value={displayMetrics.meetingsBooked} />
          <StatTile label="Personalizations" value={displayMetrics.personalizationsGenerated} />
          <StatTile label="Calls Completed" value={displayMetrics.callsCompleted} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="max-h-[min(720px,85vh)] space-y-1 overflow-y-auto rounded-xl border bg-card p-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</p>
          {GROWTH_ACTIVITY_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectFilter(option.id)}
              className={`w-full rounded-md px-2 py-2 text-left text-sm transition ${
                filterId === option.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </aside>

        <section className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold">Activity Feed</h2>
          <div className="max-h-[min(720px,85vh)] overflow-y-auto pr-1">
            {loading && events.length === 0 ? (
              <GrowthActivityFeedSkeleton />
            ) : filteredEvents.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No activity matches this filter yet. Activity appears as prospects engage across communication, content, sales, and personalization workspaces.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map((event) => (
                  <GrowthActivityEventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </section>

        {loading && events.length === 0 ? (
          <GrowthActivityRailSkeleton />
        ) : (
          <GrowthActivityHighIntentRail
            queues={railQueues}
            focusedQueueId={focusedRailQueue}
            onFocusQueue={selectRailQueue}
          />
        )}
      </div>
    </div>
  )
}
