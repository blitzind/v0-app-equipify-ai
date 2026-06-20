"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BarChart3, ExternalLink, Loader2, RefreshCw } from "lucide-react"
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
import {
  GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL,
} from "@/lib/growth/sendr/growth-sendr-branding"
import { GROWTH_SENDR_ANALYTICS_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import type {
  GrowthSendrAnalyticsDateRangePreset,
  GrowthSendrAnalyticsFunnel,
  GrowthSendrAnalyticsWorkspaceSummary,
} from "@/lib/growth/sendr/growth-sendr-types"

type AnalyticsResponse = {
  ok: boolean
  summary?: GrowthSendrAnalyticsWorkspaceSummary
  message?: string
}

type FunnelResponse = {
  ok: boolean
  funnel?: GrowthSendrAnalyticsFunnel
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

function formatPercent(value: number | null): string {
  if (value == null) return "—"
  return `${value}%`
}

export function GrowthSendrAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<GrowthSendrAnalyticsDateRangePreset>(
    GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET,
  )
  const [summary, setSummary] = useState<GrowthSendrAnalyticsWorkspaceSummary | null>(null)
  const [funnel, setFunnel] = useState<GrowthSendrAnalyticsFunnel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => buildQuery(dateRange), [dateRange])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, funnelRes] = await Promise.all([
        fetch(`/api/platform/growth/sendr/analytics?${query}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/sendr/analytics/funnel?${query}`, { cache: "no-store" }),
      ])

      const summaryData = (await summaryRes.json()) as AnalyticsResponse
      const funnelData = (await funnelRes.json()) as FunnelResponse

      if (!summaryRes.ok) {
        setError(summaryData.message ?? `${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} analytics unavailable`)
        setSummary(null)
        setFunnel(null)
        return
      }

      setSummary(summaryData.summary ?? null)
      setFunnel(funnelData.funnel ?? null)
    } catch {
      setError(`${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} analytics unavailable`)
      setSummary(null)
      setFunnel(null)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const overview = summary?.overview

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_SENDR_ANALYTICS_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Read-only pipeline intelligence — manual refresh only. Operator decides all follow-up actions.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as GrowthSendrAnalyticsDateRangePreset)}>
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

      {overview ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatTile label="Pages published" value={overview.pagesPublished} />
          <StatTile label="Launches" value={overview.launches} />
          <StatTile label="Public views" value={overview.publicViews} />
          <StatTile label="CTA clicks" value={overview.ctaClicks} />
          <StatTile label="Bookings started" value={overview.bookingsStarted} />
          <StatTile label="Bookings completed" value={overview.bookingsCompleted} />
          <StatTile label="High intent prospects" value={overview.highIntentProspects} />
        </div>
      ) : null}

      {funnel?.steps?.length ? (
        <GrowthEngineCard title="Funnel analytics" icon={<BarChart3 className="size-4" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Step</th>
                  <th className="py-2 pr-4">Count</th>
                  <th className="py-2 pr-4">Conversion</th>
                  <th className="py-2">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {funnel.steps.map((step) => (
                  <tr key={step.key} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{step.label}</td>
                    <td className="py-2 pr-4">{step.count}</td>
                    <td className="py-2 pr-4">{formatPercent(step.conversionPercent)}</td>
                    <td className="py-2">{formatPercent(step.dropOffPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Top performing pages" icon={<BarChart3 className="size-4" />}>
          {!summary?.topPages?.length ? (
            <p className="text-sm text-muted-foreground">No page engagement in this range.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {summary.topPages.map((page) => (
                <div key={page.landingPageId} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2">
                  <div className="min-w-0">
                    <Link href={`/growth/sendr/${page.landingPageId}`} className="font-medium hover:underline">
                      {page.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {page.views} views · {page.ctaClicks} CTA · {page.bookings} bookings · {page.conversionPercent}% conv
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/growth/sendr/${page.landingPageId}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="High intent prospects" icon={<BarChart3 className="size-4" />}>
          {!summary?.highIntentProspects?.length ? (
            <p className="text-sm text-muted-foreground">No high-intent prospects in this range.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {summary.highIntentProspects.map((prospect) => (
                <div key={prospect.leadId} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2">
                  <div className="min-w-0">
                    <p className="font-medium">{prospect.contactName ?? "Unknown lead"}</p>
                    <p className="text-xs text-muted-foreground">
                      Score {prospect.intentScore} · {prospect.sendrPageViewed ?? "No page"} · {prospect.recommendation ?? "Review manually"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/growth/leads/${prospect.leadId}`}>Lead</Link>
                    </Button>
                    {prospect.sendrPageId ? (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/growth/sendr/${prospect.sendrPageId}`}>Page</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Launch performance" icon={<BarChart3 className="size-4" />}>
          {!summary?.launchesNeedingAttention?.length ? (
            <p className="text-sm text-muted-foreground">No launches needing attention in this range.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {summary.launchesNeedingAttention.map((launch) => (
                <div key={launch.launchRunId} className="border-b border-border/50 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{launch.sendrPageTitle ?? "Launch"}</p>
                    <Badge variant="outline">{launch.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {launch.audienceName ?? "Audience"} · {launch.enrolled} enrolled · {launch.views} views · {launch.bookings} bookings
                  </p>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Pages needing attention" icon={<BarChart3 className="size-4" />}>
          {!summary?.pagesNeedingAttention?.length ? (
            <p className="text-sm text-muted-foreground">No pages flagged in this range.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {summary.pagesNeedingAttention.map((page) => (
                <div key={page.landingPageId} className="border-b border-border/50 pb-2">
                  <Link href={`/growth/sendr/${page.landingPageId}`} className="font-medium hover:underline">
                    {page.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{page.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Operator note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Recommendations are display-only. No outreach, sends, or background work is triggered from this dashboard.
        </CardContent>
      </Card>
    </div>
  )
}
