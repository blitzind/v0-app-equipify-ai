"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
import { GROWTH_SENDR_ACTIVITY_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import type {
  GrowthSendrActivityFeedRow,
  GrowthSendrActivityHotProspect,
  GrowthSendrActivityLeadTimeline,
  GrowthSendrActivityWorkspaceSummary,
  GrowthSendrAnalyticsDateRangePreset,
} from "@/lib/growth/sendr/growth-sendr-types"

type ActivityResponse = {
  ok: boolean
  summary?: GrowthSendrActivityWorkspaceSummary
  message?: string
}

type FeedResponse = {
  ok: boolean
  feed?: { items: GrowthSendrActivityFeedRow[] }
  message?: string
}

type ProspectsResponse = {
  ok: boolean
  prospects?: { items: GrowthSendrActivityHotProspect[] }
  message?: string
}

type TimelineResponse = {
  ok: boolean
  timelines?: { items: GrowthSendrActivityLeadTimeline[] }
  message?: string
}

const DATE_RANGE_OPTIONS: Array<{ value: GrowthSendrAnalyticsDateRangePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
]

function buildQuery(dateRange: GrowthSendrAnalyticsDateRangePreset): string {
  return new URLSearchParams({ dateRange }).toString()
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString()
}

export function GrowthSendrActivityDashboard() {
  const [dateRange, setDateRange] = useState<GrowthSendrAnalyticsDateRangePreset>(
    GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET,
  )
  const [summary, setSummary] = useState<GrowthSendrActivityWorkspaceSummary | null>(null)
  const [feed, setFeed] = useState<GrowthSendrActivityFeedRow[]>([])
  const [prospects, setProspects] = useState<GrowthSendrActivityHotProspect[]>([])
  const [timelines, setTimelines] = useState<GrowthSendrActivityLeadTimeline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => buildQuery(dateRange), [dateRange])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, feedRes, prospectsRes, timelineRes] = await Promise.all([
        fetch(`/api/platform/growth/sendr/activity?${query}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/sendr/activity/feed?${query}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/sendr/activity/prospects?${query}&sort=intent`, { cache: "no-store" }),
        fetch(`/api/platform/growth/sendr/activity/timeline?${query}`, { cache: "no-store" }),
      ])

      const summaryData = (await summaryRes.json()) as ActivityResponse
      if (!summaryRes.ok) {
        setError(summaryData.message ?? `${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} activity unavailable`)
        setSummary(null)
        setFeed([])
        setProspects([])
        setTimelines([])
        return
      }

      const feedData = (await feedRes.json()) as FeedResponse
      const prospectsData = (await prospectsRes.json()) as ProspectsResponse
      const timelineData = (await timelineRes.json()) as TimelineResponse

      setSummary(summaryData.summary ?? null)
      setFeed(feedData.feed?.items ?? summaryData.summary?.recentActivity ?? [])
      setProspects(prospectsData.prospects?.items ?? summaryData.summary?.hotProspects ?? [])
      setTimelines(timelineData.timelines?.items ?? [])
    } catch {
      setError(`${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} activity unavailable`)
      setSummary(null)
      setFeed([])
      setProspects([])
      setTimelines([])
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const counts = summary?.summary

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_SENDR_ACTIVITY_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Prospect activity timeline and follow-up workspace — read-only, operator decides all actions.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as GrowthSendrAnalyticsDateRangePreset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {counts ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatTile label="Total events" value={counts.totalEvents} />
          <StatTile label="Unique leads" value={counts.uniqueLeads} />
          <StatTile label="Page views" value={counts.pageViews} />
          <StatTile label="Video completes" value={counts.videoCompletes} />
          <StatTile label="CTA clicks" value={counts.ctaClicks} />
          <StatTile label="Bookings completed" value={counts.bookingsCompleted} />
          <StatTile label="Hot prospects" value={counts.hotProspects} />
        </div>
      ) : null}

      <GrowthEngineCard title="Recent activity feed" icon={<Activity className="size-4" />}>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No personalized video activity in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Lead</th>
                  <th className="py-2 pr-3">Page</th>
                  <th className="py-2 pr-3">Intent</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatWhen(row.occurredAt)}</td>
                    <td className="py-2 pr-3">{row.eventLabel}</td>
                    <td className="py-2 pr-3">
                      <div>{row.leadName ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{row.companyName ?? "—"}</div>
                    </td>
                    <td className="py-2 pr-3">{row.landingPageTitle ?? "—"}</td>
                    <td className="py-2 pr-3">{row.intentScore ?? "—"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.leadId ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/growth/leads/${row.leadId}`}>Lead</Link>
                          </Button>
                        ) : null}
                        {row.landingPageId ? (
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/growth/sendr/${row.landingPageId}`}>Page</Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Hot prospects queue" icon={<Activity className="size-4" />}>
        {prospects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hot prospects in this range.</p>
        ) : (
          <div className="space-y-3">
            {prospects.map((prospect) => (
              <div key={prospect.leadId} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{prospect.leadName ?? "Unknown lead"}</p>
                    <p className="text-xs text-muted-foreground">{prospect.companyName ?? "—"}</p>
                  </div>
                  <Badge variant="outline">Intent {prospect.intentScore}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {prospect.pageViews} views · {prospect.videoCompletionPercent}% video complete · {prospect.ctaClicks} CTA · Booking {prospect.bookingStatus}
                </p>
                {prospect.recommendations[0] ? (
                  <p className="mt-2 text-xs">{prospect.recommendations[0]}</p>
                ) : null}
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/growth/leads/${prospect.leadId}`}>Open Lead</Link>
                  </Button>
                  {prospect.landingPageId ? (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/growth/sendr/${prospect.landingPageId}`}>Open Page</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Prospect timelines" icon={<Activity className="size-4" />}>
        {timelines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No grouped timelines in this range.</p>
        ) : (
          <div className="space-y-4">
            {timelines.map((timeline) => (
              <div key={timeline.leadId} className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{timeline.leadName ?? "Unknown lead"}</p>
                    <p className="text-xs text-muted-foreground">{timeline.companyName ?? "—"}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/growth/leads/${timeline.leadId}`}>Open Timeline</Link>
                  </Button>
                </div>
                <div className="space-y-2 border-l pl-3 text-sm">
                  {timeline.events.map((event) => (
                    <div key={event.id}>
                      <p className="font-medium">{event.eventLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(event.occurredAt)}
                        {event.landingPageTitle ? ` · ${event.landingPageTitle}` : ""}
                      </p>
                      {event.summary ? <p className="text-xs">{event.summary}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Follow-up recommendations" icon={<Activity className="size-4" />}>
        {prospects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations in this range.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {prospects.flatMap((prospect) =>
              prospect.recommendations.map((rec, index) => (
                <div key={`${prospect.leadId}-${index}`} className="rounded-md border p-2">
                  <p className="font-medium">{prospect.leadName ?? prospect.leadId}</p>
                  <p className="text-xs text-muted-foreground">{rec}</p>
                </div>
              )),
            )}
          </div>
        )}
      </GrowthEngineCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Operator note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Recommendations are display-only. No emails, sequences, tasks, or outreach are executed automatically.
        </CardContent>
      </Card>
    </div>
  )
}
