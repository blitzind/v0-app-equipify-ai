"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Archive, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { fetchGrowthVideoAsset } from "@/components/growth/videos/use-growth-video-assets"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthVideoAsset } from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoAssetDetailPanel({ assetId }: { assetId: string }) {
  const pathname = usePathname()
  const [asset, setAsset] = useState<GrowthVideoAsset | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchGrowthVideoAsset(assetId)
    if (!result.ok || !result.asset) {
      setError(result.error ?? "not_found")
      setAsset(null)
      setPlaybackUrl(null)
    } else {
      setAsset(result.asset)
      setPlaybackUrl(result.playbackUrl ?? null)
    }
    setLoading(false)
  }, [assetId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    setActing(true)
    try {
      const res = await fetch(`/api/growth/videos/assets/${encodeURIComponent(assetId)}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (method === "DELETE") {
        window.location.href = growthFeaturePath(pathname, "videos/library")
        return
      }
      if (res.ok) await load()
    } finally {
      setActing(false)
    }
  }

  return (
    <GrowthVideoWorkspaceShell title="Video details" description="Asset metadata, playback, and operator actions.">
      <div className="mb-3">
        <Button size="sm" variant="outline" asChild>
          <Link href={growthFeaturePath(pathname, "videos/library")}>Back to library</Link>
        </Button>
      </div>

      <GrowthEnginePanelResilience loading={loading} error={error} isEmpty={!asset} onRetry={() => void load()}>
        {asset ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{asset.title}</h3>
              <GrowthBadge tone="neutral">{asset.status}</GrowthBadge>
              <GrowthBadge tone="neutral">{asset.uploadStatus}</GrowthBadge>
            </div>

            {asset.description ? <p className="text-sm text-muted-foreground">{asset.description}</p> : null}

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              {playbackUrl ? (
                <video src={playbackUrl} controls className="w-full max-h-[360px] rounded-lg bg-black" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
                  Thumbnail / playback placeholder — available after upload completes.
                </div>
              )}
            </div>

            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="text-muted-foreground">Source</dt><dd>{asset.sourceType}</dd></div>
              <div><dt className="text-muted-foreground">MIME</dt><dd>{asset.mimeType ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">File size</dt><dd>{asset.fileSizeBytes ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Duration</dt><dd>{asset.durationSeconds ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Storage path</dt><dd className="break-all">{asset.storagePath ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Thumbnail path</dt><dd className="break-all">{asset.thumbnailPath ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Created</dt><dd>{new Date(asset.createdAt).toLocaleString()}</dd></div>
              <div><dt className="text-muted-foreground">Updated</dt><dd>{new Date(asset.updatedAt).toLocaleString()}</dd></div>
            </dl>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">Analytics placeholder</p>
              <p className="text-xs text-muted-foreground">Views, watch rate, and CTA metrics arrive in a later phase.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={acting || asset.status === "archived"}
                onClick={() => void runAction("PATCH", { status: "archived" })}
              >
                {acting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Archive className="mr-1 h-3 w-3" />}
                Archive
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={acting}
                onClick={() => {
                  if (confirm("Delete this video asset?")) void runAction("DELETE")
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </GrowthEnginePanelResilience>
    </GrowthVideoWorkspaceShell>
  )
}
