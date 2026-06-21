"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Play, Search, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GrowthSendrAssetPickerItem } from "@/lib/growth/sendr/growth-sendr-types"
import {
  buildGrowthVideoLibraryHref,
  buildGrowthVideoRecordHref,
  type SendrVideoReturnContext,
} from "@/lib/growth/sendr/growth-sendr-video-return-flow"

type PreviewPayload = {
  title: string
  playbackUrl: string | null
  posterUrl: string | null
  durationSeconds: number | null
}

type VideoLibraryHints = {
  growthAssetCount: number
  legacyMetadataCount: number
  isEmpty: boolean
}

type Props = {
  kind?: "media" | "video" | "booking" | "landing_page" | "all"
  onSelect: (item: GrowthSendrAssetPickerItem) => void
  selectedId?: string | null
  disabled?: boolean
  showVideoShortcuts?: boolean
  attachLabel?: string
  returnContext?: SendrVideoReturnContext | null
}

export function GrowthSendrAssetPickerPanel({
  kind = "all",
  onSelect,
  selectedId,
  disabled,
  showVideoShortcuts = false,
  attachLabel = "Attach",
  returnContext = null,
}: Props) {
  const [items, setItems] = useState<GrowthSendrAssetPickerItem[]>([])
  const [videoLibrary, setVideoLibrary] = useState<VideoLibraryHints | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [filterKind, setFilterKind] = useState<string>(kind)
  const [previewItem, setPreviewItem] = useState<GrowthSendrAssetPickerItem | null>(null)
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        kind: filterKind,
        limit: "50",
      })
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(`/api/platform/growth/sendr/assets?${params.toString()}`, {
        cache: "no-store",
      })
      const data = (await res.json()) as {
        ok: boolean
        items?: GrowthSendrAssetPickerItem[]
        videoLibrary?: VideoLibraryHints
      }
      setItems(data.items ?? [])
      setVideoLibrary(data.videoLibrary ?? null)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filterKind, search])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => items, [items])

  const displayItems = useMemo(() => {
    if (!showVideoShortcuts) return filtered
    return filtered.filter(
      (item) => item.assetKind !== "video" || item.metadata.source === "growth_library",
    )
  }, [filtered, showVideoShortcuts])

  const growthLibraryEmpty =
    showVideoShortcuts &&
    (videoLibrary?.isEmpty ?? displayItems.filter((item) => item.assetKind === "video").length === 0)

  function isItemAttachable(item: GrowthSendrAssetPickerItem): boolean {
    if (item.metadata.attachable === false) return false
    if (showVideoShortcuts && item.assetKind === "video" && item.metadata.source !== "growth_library") {
      return false
    }
    return true
  }

  async function openPreview(item: GrowthSendrAssetPickerItem) {
    setPreviewItem(item)
    setPreviewPayload(null)
    setPreviewLoading(true)
    try {
      if (item.assetKind === "video" && item.metadata.source === "growth_library") {
        const res = await fetch(
          `/api/platform/growth/sendr/video-assets?growthVideoAssetId=${encodeURIComponent(item.id)}`,
          { cache: "no-store" },
        )
        const data = (await res.json()) as { ok: boolean; preview?: PreviewPayload }
        if (data.ok && data.preview) {
          setPreviewPayload(data.preview)
          return
        }
      }
      setPreviewPayload({
        title: item.name,
        playbackUrl:
          typeof item.metadata.sourceUrl === "string" ? item.metadata.sourceUrl : item.previewUrl,
        posterUrl: item.previewUrl,
        durationSeconds:
          typeof item.metadata.durationSeconds === "number" ? item.metadata.durationSeconds : null,
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      {showVideoShortcuts ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild disabled={disabled}>
            <Link
              href={
                returnContext
                  ? buildGrowthVideoRecordHref(returnContext)
                  : "/growth/videos/record"
              }
            >
              <Video className="mr-1 h-4 w-4" />
              Record Video
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild disabled={disabled}>
            <Link
              href={
                returnContext
                  ? buildGrowthVideoLibraryHref(returnContext, { openUpload: true })
                  : "/growth/videos/library?upload=1"
              }
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              Upload Video
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild disabled={disabled}>
            <Link
              href={
                returnContext
                  ? buildGrowthVideoLibraryHref(returnContext)
                  : "/growth/videos/library"
              }
            >
              Open Video Library
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Select value={filterKind} onValueChange={setFilterKind} disabled={disabled || kind !== "all"}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="booking">Booking</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="landing_page">Pages</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || disabled}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {loading && displayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading assets…</p>
        ) : growthLibraryEmpty ? (
          <div className="space-y-2 rounded-md border border-dashed p-4">
            <p className="text-sm font-medium">No Growth Video assets yet</p>
            <p className="text-xs text-muted-foreground">
              Upload an MP4 from the Video Library, then return here to attach it to this page.
              Recording is not available yet — use Upload Video for now.
            </p>
            {(videoLibrary?.legacyMetadataCount ?? 0) > 0 ? (
              <p className="text-xs text-muted-foreground">
                Legacy URL-only metadata rows are hidden here. Re-upload through Growth Video Library
                for signed playback on Personalized Video pages.
              </p>
            ) : null}
          </div>
        ) : displayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets found.</p>
        ) : (
          displayItems.map((item) => (
            <div
              key={`${item.assetKind}-${item.id}`}
              className={`flex items-center gap-3 rounded-md border p-2 ${
                selectedId === item.id ? "border-primary bg-muted/30" : ""
              }`}
            >
              {item.previewUrl && item.assetKind === "video" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded object-cover bg-muted"
                />
              ) : (
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-muted">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="outline">{item.status}</Badge>
                {item.metadata.source === "sendr_metadata" ? (
                  <Badge variant="secondary">Legacy</Badge>
                ) : null}
                {item.assetKind === "video" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => void openPreview(item)}
                    aria-label="Preview video"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || !isItemAttachable(item)}
                  onClick={() => onSelect(item)}
                >
                  {selectedId === item.id ? "Replace" : attachLabel}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={previewItem != null} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewItem?.name ?? "Video preview"}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewPayload?.playbackUrl ? (
            <video
              className="w-full rounded-md bg-black"
              controls
              playsInline
              poster={previewPayload.posterUrl ?? undefined}
              src={previewPayload.playbackUrl}
            />
          ) : previewPayload?.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewPayload.posterUrl} alt="" className="w-full rounded-md" />
          ) : (
            <p className="text-sm text-muted-foreground">Preview unavailable for this asset.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
