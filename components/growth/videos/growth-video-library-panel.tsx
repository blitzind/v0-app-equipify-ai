"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Archive, ArrowLeft, Eye, Loader2, Pencil, Search, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthVideoLibraryFirstRun } from "@/components/growth/videos/growth-video-library-first-run"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { GrowthVideoUploadModal } from "@/components/growth/videos/growth-video-upload-modal"
import { useGrowthVideoAssets } from "@/components/growth/videos/use-growth-video-assets"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthVideoAsset, GrowthVideoAssetStatus } from "@/lib/growth/videos/growth-video-types"
import {
  buildSendrReturnWithAssetPath,
  parseSendrVideoReturnContext,
  SENDR_VIDEO_RETURN_QUERY,
} from "@/lib/growth/sendr/growth-sendr-video-return-flow"

const FILTERS: Array<{ label: string; value?: GrowthVideoAssetStatus }> = [
  { label: "All" },
  { label: "Draft", value: "draft" },
  { label: "Ready", value: "ready" },
  { label: "Archived", value: "archived" },
]

function statusTone(status: GrowthVideoAssetStatus) {
  switch (status) {
    case "ready":
      return "healthy" as const
    case "processing":
      return "attention" as const
    case "failed":
      return "critical" as const
    default:
      return "neutral" as const
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function GrowthVideoLibraryPanel() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnContext = parseSendrVideoReturnContext(searchParams)
  const { items, loading, error, load } = useGrowthVideoAssets()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<GrowthVideoAssetStatus | undefined>(undefined)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get(SENDR_VIDEO_RETURN_QUERY.upload) === "1") {
      setUploadOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    void load({ status: filter, search })
  }, [filter, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [items, search])

  async function patchAsset(assetId: string, body: Record<string, unknown>) {
    setActingId(assetId)
    try {
      await fetch(`/api/growth/videos/assets/${encodeURIComponent(assetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      await load({ status: filter, search })
    } finally {
      setActingId(null)
    }
  }

  async function deleteAsset(assetId: string) {
    setActingId(assetId)
    try {
      await fetch(`/api/growth/videos/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" })
      await load({ status: filter, search })
    } finally {
      setActingId(null)
    }
  }

  function handleUploadedAsset(asset: GrowthVideoAsset) {
    if (returnContext) {
      router.push(buildSendrReturnWithAssetPath(returnContext, asset.id))
      return
    }
    void load({ status: filter, search })
  }

  const isLibraryEmpty = !loading && items.length === 0 && !search.trim() && !filter

  return (
    <GrowthVideoWorkspaceShell
      title="Video Library"
      description="Upload and manage video assets for personalized video pages."
    >
      {returnContext ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <p>
            Upload or choose a video to return to your Personalized Video Page
            {returnContext.sectionId ? " section" : ""}.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href={returnContext.returnTo}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to page
            </Link>
          </Button>
        </div>
      ) : null}
      {isLibraryEmpty ? (
        <GrowthVideoLibraryFirstRun pathname={pathname} onUpload={() => setUploadOpen(true)} />
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search videos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load({ status: filter, search })
            }}
          />
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-1 h-4 w-4" />
          Upload video
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <Button
            key={entry.label}
            size="sm"
            variant={filter === entry.value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilter(entry.value)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      <GrowthEnginePanelResilience
        loading={loading}
        error={error}
        isEmpty={!loading && filtered.length === 0}
        emptyKind="no_data"
        onRetry={() => void load({ status: filter, search })}
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No videos match your search. Try a different term or upload a new video.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{asset.title}</p>
                    <p className="text-xs text-muted-foreground">{asset.sourceType.replace(/_/g, " ")}</p>
                  </div>
                  <GrowthBadge tone={statusTone(asset.status)}>{asset.status}</GrowthBadge>
                </div>
                <div className="mb-3 space-y-1 text-xs text-muted-foreground">
                  <p>Upload: {asset.uploadStatus}</p>
                  <p>Size: {formatBytes(asset.fileSizeBytes)}</p>
                  <p>Duration: {asset.durationSeconds ? `${asset.durationSeconds}s` : "—"}</p>
                  <p>Created: {new Date(asset.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {returnContext ? (
                    <Button size="sm" asChild>
                      <Link href={buildSendrReturnWithAssetPath(returnContext, asset.id)}>Use for page</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" asChild>
                    <Link href={growthFeaturePath(pathname, `videos/library/${asset.id}`)}>
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === asset.id}
                    onClick={() => {
                      const nextTitle = prompt("Rename video", asset.title)
                      if (nextTitle?.trim()) void patchAsset(asset.id, { title: nextTitle.trim() })
                    }}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === asset.id || asset.status === "archived"}
                    onClick={() => void patchAsset(asset.id, { status: "archived" })}
                  >
                    <Archive className="mr-1 h-3 w-3" />
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === asset.id}
                    onClick={() => {
                      if (confirm("Delete this video asset?")) void deleteAsset(asset.id)
                    }}
                  >
                    {actingId === asset.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEnginePanelResilience>
        </>
      )}

      <GrowthVideoUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={handleUploadedAsset}
      />
    </GrowthVideoWorkspaceShell>
  )
}
