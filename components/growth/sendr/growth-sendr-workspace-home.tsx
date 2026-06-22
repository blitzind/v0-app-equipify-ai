"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw, Rocket, Sparkles, BarChart3, Activity, Video, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  GrowthSendrLandingPage,
  GrowthSendrMediaAsset,
  GrowthSendrWorkspaceSummary,
} from "@/lib/growth/sendr/growth-sendr-types"
import { GROWTH_PERSONALIZED_VIDEOS_DASHBOARD_UX_QA_MARKER } from "@/lib/growth/activity/growth-activity-workspace-constants"
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL, GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL, GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH, buildGrowthPersonalizedVideosPageDetailPath, buildGrowthPersonalizedVideosWorkspaceHref } from "@/lib/growth/sendr/growth-sendr-branding"
import { GROWTH_SENDR_INTELLIGENCE_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"

type WorkspaceResponse = {
  ok: boolean
  summary?: GrowthSendrWorkspaceSummary
  message?: string
}

function statusBadge(status: string) {
  if (status === "published") return <Badge className="bg-green-600">Published</Badge>
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>
  return <Badge variant="outline">Draft</Badge>
}

function computeAverageCompletion(
  pages: Array<{ completionRate?: number }> | undefined,
): string {
  if (!pages?.length) return "—"
  const rates = pages.map((page) => page.completionRate ?? 0).filter((rate) => rate >= 0)
  if (!rates.length) return "—"
  const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  return `${Math.round(average)}%`
}

function computeMeetingsBooked(
  metrics: GrowthSendrWorkspaceSummary["metrics"],
  intelligence: GrowthSendrWorkspaceSummary["intelligence"],
): number {
  const fromMetrics = metrics?.topPages.reduce((sum, page) => sum + (page.bookings ?? 0), 0) ?? 0
  if (fromMetrics > 0) return fromMetrics
  return (
    intelligence?.topPerformingPages.reduce((sum, page) => sum + page.bookingCompletes, 0) ?? 0
  )
}

export function GrowthSendrWorkspaceHome() {
  const [summary, setSummary] = useState<GrowthSendrWorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/workspace", { cache: "no-store" })
      const data = (await res.json()) as WorkspaceResponse
      if (!res.ok) {
        setError(data.message ?? `${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} workspace unavailable`)
        setSummary(null)
        return
      }
      setSummary(data.summary ?? null)
    } catch {
      setError(`${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} workspace unavailable`)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6" data-qa={GROWTH_PERSONALIZED_VIDEOS_DASHBOARD_UX_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Create personalized video pages, attach media and booking, publish manually.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH}>
              <Activity className="mr-1 h-4 w-4" />
              Activity
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={buildGrowthPersonalizedVideosWorkspaceHref("analytics")}>
              <BarChart3 className="mr-1 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/growth/videos/record">
              <Video className="mr-1 h-4 w-4" />
              Record Video
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/growth/videos/library">
              <ExternalLink className="mr-1 h-4 w-4" />
              Video Library
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={buildGrowthPersonalizedVideosWorkspaceHref("launch")}>
              <Rocket className="mr-1 h-4 w-4" />
              Launch Campaign
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={buildGrowthPersonalizedVideosWorkspaceHref("new")}>
              <Plus className="mr-1 h-4 w-4" />
              Create Video Page
            </Link>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {summary?.metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.metrics.publishedPagesTotal}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.metrics.activeSequenceCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Views Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.metrics.viewsToday}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CTA Clicks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.metrics.ctaClicksToday}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meetings Booked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {computeMeetingsBooked(summary.metrics, summary.intelligence)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {computeAverageCompletion(summary.intelligence?.topPerformingPages)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {summary?.metrics ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Pages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.metrics.topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No personalized video pages yet.
                <br />
                Create your first personalized video experience.
              </p>
            ) : (
              summary.metrics.topPages.map((page) => (
                <Link
                  key={page.landingPageId}
                  href={buildGrowthPersonalizedVideosPageDetailPath(page.landingPageId)}
                  className="block rounded-md border p-3 text-sm hover:bg-muted/50"
                >
                  <p className="font-medium">{page.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{page.views} views</span>
                    <span>{page.ctaRate}% CTA</span>
                    <span>{page.bookings} meetings</span>
                    <span>{page.views > 0 ? "Recent activity" : "No activity yet"}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {summary?.intelligence ? (
        <div className="grid gap-4 lg:grid-cols-3" data-qa-marker={GROWTH_SENDR_INTELLIGENCE_QA_MARKER}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top performing pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary.intelligence.topPerformingPages.length === 0 ? (
                <p className="text-muted-foreground">No page engagement yet.</p>
              ) : (
                summary.intelligence.topPerformingPages.map((page) => (
                  <div key={page.landingPageId} className="rounded-md border p-2">
                    <p className="font-medium">{page.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {page.pageViews} views · {page.bookingCompletes} bookings · {page.ctaRate}% CTA
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">High intent prospects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary.intelligence.highIntentProspects.length === 0 ? (
                <p className="text-muted-foreground">
                  No engaged prospects yet.
                  <br />
                  Activity will appear as prospects interact with pages.
                </p>
              ) : (
                summary.intelligence.highIntentProspects.map((prospect) => (
                  <div key={prospect.leadId} className="rounded-md border p-2">
                    <p className="font-medium">{prospect.contactName ?? prospect.companyName ?? prospect.leadId}</p>
                    <p className="text-xs text-muted-foreground">
                      Score {prospect.intentScore} ({prospect.intentLevel}) ·{" "}
                      {prospect.landingPageTitle ?? GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL}
                    </p>
                    {prospect.recommendations[0] ? (
                      <p className="mt-1 text-xs">{prospect.recommendations[0].title}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pages needing attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary.intelligence.pagesNeedingAttention.length === 0 ? (
                <p className="text-muted-foreground">Everything looks healthy.</p>
              ) : (
                summary.intelligence.pagesNeedingAttention.map((page) => (
                  <div key={page.landingPageId} className="rounded-md border p-2">
                    <p className="font-medium">{page.title}</p>
                    <p className="text-xs text-muted-foreground">{page.attentionReason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pages today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.pagesCreatedToday}</p>
              <p className="text-xs text-muted-foreground">{summary.pagesPublishedToday} published</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Media assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.assetsCreatedToday}</p>
              <p className="text-xs text-muted-foreground">created today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.engagementEventsToday}</p>
              <p className="text-xs text-muted-foreground">events today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Guardrails</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.throttlesToday}</p>
              <p className="text-xs text-muted-foreground">
                throttles · {summary.failuresToday} failures · schema{" "}
                {summary.schemaReady ? "ready" : "missing"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Recent landing pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && !summary ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : (summary?.recentPages.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No personalized video pages yet.
                <br />
                Create your first personalized video experience.
              </p>
            ) : (
              summary?.recentPages.map((page: GrowthSendrLandingPage) => (
                <Link
                  key={page.id}
                  href={buildGrowthPersonalizedVideosPageDetailPath(page.id)}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{page.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(page.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  {statusBadge(page.status)}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent media assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.recentMediaAssets.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No media assets registered yet.</p>
            ) : (
              summary?.recentMediaAssets.map((asset: GrowthSendrMediaAsset) => (
                <div key={asset.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{asset.name}</p>
                    <Badge variant="outline">{asset.assetType}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {asset.status} · {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
