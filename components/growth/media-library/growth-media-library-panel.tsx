"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthMediaLibraryAssetCard } from "@/components/growth/media-library/growth-media-library-asset-card"
import { GrowthMediaLibraryUploadZone } from "@/components/growth/media-library/growth-media-library-upload-zone"
import {
  GROWTH_MEDIA_LIBRARY_1B_QA_MARKER,
  GROWTH_MEDIA_LIBRARY_QA_MARKER,
  type GrowthMediaLibraryAsset,
  type GrowthMediaLibraryKind,
} from "@/lib/growth/media-library/growth-media-library-types"
import { GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS } from "@/lib/growth/media-library/growth-media-library-categories"
import {
  archiveGrowthMediaLibraryAsset,
  listGrowthMediaLibraryAssets,
  updateGrowthMediaLibraryAsset,
  uploadGrowthMediaLibraryFile,
} from "@/lib/growth/media-library/growth-media-library-upload"

export function GrowthMediaLibraryPanel() {
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
  const [editCategory, setEditCategory] = useState<GrowthMediaLibraryKind>("image")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await listGrowthMediaLibraryAssets({ libraryKind: filter, search })
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
      await archiveGrowthMediaLibraryAsset(assetId)
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
      await updateGrowthMediaLibraryAsset({
        assetId: editing.id,
        title: editTitle,
        altText: editAltText,
        libraryKind: editCategory,
      })
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
    <div className="space-y-4" data-qa={GROWTH_MEDIA_LIBRARY_QA_MARKER} data-qa-marker={GROWTH_MEDIA_LIBRARY_1B_QA_MARKER}>
      <GrowthEngineCard className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Growth Media Library</h2>
            <p className="text-sm text-muted-foreground">
              Upload logos, team photos, hero images, and reusable assets for signatures, booking pages, and share
              pages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as GrowthMediaLibraryKind | "all")}
            >
              {GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              className="h-9 w-48"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <GrowthMediaLibraryUploadZone disabled={uploading} uploading={uploading} onUpload={handleUpload} />

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading media assets…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No media assets in this category yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((asset) => (
              <GrowthMediaLibraryAssetCard
                key={asset.id}
                asset={asset}
                acting={actingId === asset.id}
                onEdit={(next) => {
                  setEditing(next)
                  setEditTitle(next.title)
                  setEditAltText(next.altText ?? "")
                  setEditCategory(next.libraryKind)
                }}
                onCopyUrl={(next) => void navigator.clipboard.writeText(next.publicUrl)}
                onArchive={(next) => void archiveAsset(next.id)}
              />
            ))}
          </div>
        )}
      </GrowthEngineCard>

      {editing ? (
        <GrowthEngineCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Edit asset</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="media-library-edit-title">Title</Label>
              <Input
                id="media-library-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-library-edit-category">Category</Label>
              <select
                id="media-library-edit-category"
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as GrowthMediaLibraryKind)}
              >
                {GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-library-edit-alt">Alt text</Label>
            <Input
              id="media-library-edit-alt"
              value={editAltText}
              onChange={(e) => setEditAltText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveEdits()} disabled={actingId === editing.id}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(editing.publicUrl)}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copy URL
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
