"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  GrowthSendrLandingPage,
  GrowthSendrMediaAsset,
  GrowthSendrWorkspaceSummary,
} from "@/lib/growth/sendr/growth-sendr-types"

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
        setError(data.message ?? "SENDR workspace unavailable")
        setSummary(null)
        return
      }
      setSummary(data.summary ?? null)
    } catch {
      setError("SENDR workspace unavailable")
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
          <Button size="sm" asChild>
            <Link href="/growth/sendr/new">
              <Plus className="mr-1 h-4 w-4" />
              Create Page
            </Link>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
