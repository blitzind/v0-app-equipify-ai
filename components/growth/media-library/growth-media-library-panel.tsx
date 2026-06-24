"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Copy, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR,
  GROWTH_MEDIA_LIBRARY_QA_MARKER,
  type GrowthMediaLibraryAsset,
  type GrowthMediaLibraryKind,
} from "@/lib/growth/media-library/growth-media-library-types"
import {
  listGrowthMediaLibraryAssets,
  uploadGrowthMediaLibraryFile,
} from "@/lib/growth/media-library/growth-media-library-upload"

export function GrowthMediaLibraryPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<GrowthMediaLibraryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<GrowthMediaLibraryKind | "all">("all")
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<GrowthMediaLibraryAsset | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editAltText, setEditAltText] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const libraryKind = filter === "all" ? undefined : filter
      const next = await listGrowthMediaLibraryAssets({ libraryKind, search })
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load media library.")
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpload(file: File) {
    setUploading(true)
    setMessage(null)
    setError(null)
    try {
      await uploadGrowthMediaLibraryFile({
        file,
        libraryKind: filter === "all" ? "image" : filter,
        title: file.name,
      })
      setMessage("Image uploaded.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  async function archiveAsset(assetId: string) {
    setActingId(assetId)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/media-assets/${assetId}`, { method: "DELETE" })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "archive_failed")
      setMessage("Asset archived.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive asset.")
    } finally {
      setActingId(null)
    }
  }

  async function saveEdits() {
    if (!editing) return
    setActingId(editing.id)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/media-assets/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          metadata: { alt_text: editAltText.trim() || null },
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "update_failed")
      setMessage("Asset updated.")
      setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update asset.")
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-4" data-qa={GROWTH_MEDIA_LIBRARY_QA_MARKER}>
      <GrowthEngineCard className="p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Growth Media Library</h2>
            <p className="text-sm text-muted-foreground">
              Upload logos and images once, then reuse them across signatures, booking pages, and share pages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as GrowthMediaLibraryKind | "all")}
            >
              <option value="all">All images</option>
              <option value="logo">Logos</option>
              <option value="avatar">Avatars</option>
              <option value="image">General images</option>
            </select>
            <Input
              className="h-9 w-48"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              Upload image
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR}
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void handleUpload(file)
          }}
        />

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading media assets…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No media assets yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((asset) => (
              <div key={asset.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex h-32 items-center justify-center rounded-md bg-muted/30 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.previewUrl || asset.publicUrl}
                    alt={asset.altText ?? asset.title}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <p className="truncate text-sm font-medium">{asset.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{asset.libraryKind}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(asset)
                      setEditTitle(asset.title)
                      setEditAltText(asset.altText ?? "")
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(asset.publicUrl)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actingId === asset.id}
                    onClick={() => void archiveAsset(asset.id)}
                  >
                    {actingId === asset.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      {editing ? (
        <GrowthEngineCard className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Edit asset</h3>
          <div className="space-y-2">
            <Label htmlFor="media-library-edit-title">Title</Label>
            <Input
              id="media-library-edit-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-library-edit-alt">Alt text</Label>
            <Input
              id="media-library-edit-alt"
              value={editAltText}
              onChange={(e) => setEditAltText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void saveEdits()} disabled={actingId === editing.id}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
