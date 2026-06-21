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
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL, GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Operator launch center — create personalized pages, attach media & booking, publish manually.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/growth/sendr/activity">
              <Activity className="mr-1 h-4 w-4" />
              Activity
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/growth/sendr/analytics">
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
            <Link href="/growth/sendr/launch">
              <Rocket className="mr-1 h-4 w-4" />
              Launch Campaign
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/growth/sendr/new">
              <Plus className="mr-1 h-4 w-4" />
              Create Page
            </Link>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {summary?.metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published pages</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.metrics.publishedPagesTotal}</p>
              <p className="text-xs text-muted-foreground">
                {summary.metrics.viewsToday} views · {summary.metrics.ctaClicksToday} CTA clicks today
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attached to sequences</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.metrics.attachedToSequencesCount}</p>
              <p className="text-xs text-muted-foreground">
                {summary.metrics.activeSequenceCount} active sequences
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top pages (today)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {summary.metrics.topPages.length === 0 ? (
                <p className="text-muted-foreground">No engagement yet.</p>
              ) : (
                summary.metrics.topPages.map((page) => (
                  <div key={page.landingPageId} className="flex justify-between gap-2">
                    <span className="truncate">{page.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {page.views}v · {page.ctaRate}% CTA
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
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
                <p className="text-muted-foreground">No high-intent prospects yet.</p>
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
                <p className="text-muted-foreground">All pages performing within expected ranges.</p>
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
              <p className="text-sm text-muted-foreground">No pages yet. Create your first page.</p>
            ) : (
              summary?.recentPages.map((page: GrowthSendrLandingPage) => (
                <Link
                  key={page.id}
                  href={`/growth/sendr/${page.id}`}
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
