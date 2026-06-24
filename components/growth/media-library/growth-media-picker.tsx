"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageIcon, Link2, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GrowthMediaLibraryAssetCard } from "@/components/growth/media-library/growth-media-library-asset-card"
import { GrowthMediaLibraryUploadZone } from "@/components/growth/media-library/growth-media-library-upload-zone"
import {
  GROWTH_MEDIA_LIBRARY_1B_QA_MARKER,
  type GrowthMediaLibraryAsset,
  type GrowthMediaLibraryKind,
} from "@/lib/growth/media-library/growth-media-library-types"
import {
  defaultGrowthMediaLibraryKind,
  GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS,
} from "@/lib/growth/media-library/growth-media-library-categories"
import {
  archiveGrowthMediaLibraryAsset,
  listGrowthMediaLibraryAssets,
  updateGrowthMediaLibraryAsset,
  uploadGrowthMediaLibraryFile,
} from "@/lib/growth/media-library/growth-media-library-upload"
import {
  normalizeGrowthMediaLibraryPersistedUrl,
} from "@/lib/growth/media-library/growth-media-library-canonical-url"
import { buildGrowthMediaLibraryPublicUrl } from "@/lib/growth/media-library/growth-media-library-url"
import { cn } from "@/lib/utils"

type PickerMode = "library" | "upload" | "advanced"

type Props = {
  value?: string
  onChange: (url: string, asset?: GrowthMediaLibraryAsset) => void
  acceptedTypes?: GrowthMediaLibraryKind[]
  label?: string
  allowManualUrl?: boolean
  disabled?: boolean
  id?: string
}

function matchesAcceptedTypes(
  asset: GrowthMediaLibraryAsset,
  acceptedTypes?: GrowthMediaLibraryKind[],
): boolean {
  if (!acceptedTypes || acceptedTypes.length === 0) return true
  return acceptedTypes.includes(asset.libraryKind)
}

export function GrowthMediaPicker({
  value,
  onChange,
  acceptedTypes,
  label = "Image",
  allowManualUrl = true,
  disabled,
  id,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PickerMode>("library")
  const [manualUrl, setManualUrl] = useState(value ?? "")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<GrowthMediaLibraryAsset[]>([])
  const [filter, setFilter] = useState<GrowthMediaLibraryKind | "all">("all")
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<GrowthMediaLibraryAsset | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editAltText, setEditAltText] = useState("")
  const [editCategory, setEditCategory] = useState<GrowthMediaLibraryKind>("image")
  const openModeRef = useRef<PickerMode>("library")

  const previewUrl = value?.trim() || ""
  const uploadKind = defaultGrowthMediaLibraryKind(acceptedTypes)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await listGrowthMediaLibraryAssets({
        libraryKind: filter,
      })
      setItems(next.filter((item) => matchesAcceptedTypes(item, acceptedTypes)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load media library.")
    } finally {
      setLoading(false)
    }
  }, [acceptedTypes, filter])

  useEffect(() => {
    if (!open) return
    void loadItems()
  }, [open, loadItems])

  useEffect(() => {
    setManualUrl(value ?? "")
  }, [value])

  useEffect(() => {
    if (!open) return
    setMode(openModeRef.current)
  }, [open])

  function openPicker(nextMode: PickerMode = "library") {
    openModeRef.current = nextMode
    setMode(nextMode)
    setOpen(true)
  }

  async function handleUpload(file: File, options?: { selectAfterUpload?: boolean }) {
    setUploading(true)
    setError(null)
    try {
      const result = await uploadGrowthMediaLibraryFile({
        file,
        libraryKind: uploadKind,
        title: file.name,
      })
      setHighlightId(result.asset.id)
      setMode("library")
      await loadItems()
      if (options?.selectAfterUpload) {
        selectAsset(result.asset)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  function selectAsset(asset: GrowthMediaLibraryAsset) {
    const url = normalizeGrowthMediaLibraryPersistedUrl(
      asset.publicUrl || buildGrowthMediaLibraryPublicUrl(asset.id),
      { assetId: asset.id },
    )
    onChange(url, asset)
    setOpen(false)
  }

  function applyManualUrl() {
    onChange(manualUrl.trim())
    setOpen(false)
  }

  async function saveEdit() {
    if (!editing) return
    setActingId(editing.id)
    setError(null)
    try {
      await updateGrowthMediaLibraryAsset({
        assetId: editing.id,
        title: editTitle,
        altText: editAltText,
        libraryKind: editCategory,
      })
      setEditing(null)
      await loadItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update asset.")
    } finally {
      setActingId(null)
    }
  }

  async function handleArchive(asset: GrowthMediaLibraryAsset) {
    setActingId(asset.id)
    setError(null)
    try {
      await archiveGrowthMediaLibraryAsset(asset.id)
      await loadItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive asset.")
    } finally {
      setActingId(null)
    }
  }

  const filteredCategoryOptions = GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS.filter((option) => {
    if (option.value === "all") return true
    if (!acceptedTypes || acceptedTypes.length === 0) return true
    return acceptedTypes.includes(option.value)
  })

  return (
    <div className="space-y-2" data-qa="growth-media-picker" data-qa-marker={GROWTH_MEDIA_LIBRARY_1B_QA_MARKER}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {previewUrl ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-muted/30 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => openPicker("library")}>
          Choose from library
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => openPicker("upload")}
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          Upload image
        </Button>
        {value?.trim() ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange("")}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            {(
              [
                { id: "upload" as const, label: "Upload Image", icon: Upload },
                { id: "library" as const, label: "Choose From Library", icon: ImageIcon },
                ...(allowManualUrl
                  ? [{ id: "advanced" as const, label: "Paste URL (Advanced)", icon: Link2 }]
                  : []),
              ] as const
            ).map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={mode === tab.id ? "default" : "outline"}
                onClick={() => setMode(tab.id)}
              >
                <tab.icon className="mr-1 h-3.5 w-3.5" />
                {tab.label}
              </Button>
            ))}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {mode === "upload" ? (
            <GrowthMediaLibraryUploadZone
              disabled={disabled}
              uploading={uploading}
              onUpload={(file) => handleUpload(file)}
            />
          ) : null}

          {mode === "advanced" && allowManualUrl ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <p className="text-sm font-medium">Advanced</p>
              <div className="space-y-2">
                <Label htmlFor="growth-media-picker-manual-url">Paste URL</Label>
                <Input
                  id="growth-media-picker-manual-url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
                <p className="text-xs text-muted-foreground">
                  Use only when the image is hosted elsewhere. Prefer uploading to the media library.
                </p>
              </div>
            </div>
          ) : null}

          {mode === "library" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as GrowthMediaLibraryKind | "all")}
                >
                  {filteredCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadItems()}>
                  Refresh
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setMode("upload")}>
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  Upload Image
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading assets…
                </div>
              ) : items.length === 0 ? (
                <div className="space-y-4 rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">No media assets yet.</p>
                  <GrowthMediaLibraryUploadZone
                    compact
                    disabled={disabled}
                    uploading={uploading}
                    className="mx-auto max-w-md"
                    onUpload={(file) => handleUpload(file)}
                  />
                </div>
              ) : (
                <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((asset) => (
                    <GrowthMediaLibraryAssetCard
                      key={asset.id}
                      asset={asset}
                      highlighted={highlightId === asset.id}
                      acting={actingId === asset.id}
                      onSelect={selectAsset}
                      onEdit={(next) => {
                        setEditing(next)
                        setEditTitle(next.title)
                        setEditAltText(next.altText ?? "")
                        setEditCategory(next.libraryKind)
                      }}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {editing ? (
            <div className={cn("space-y-3 rounded-lg border border-border/60 p-4")}>
              <p className="text-sm font-medium">Edit asset</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="picker-edit-title">Title</Label>
                  <Input
                    id="picker-edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="picker-edit-category">Category</Label>
                  <select
                    id="picker-edit-category"
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as GrowthMediaLibraryKind)}
                  >
                    {GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS.filter((o) => o.value !== "all").map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="picker-edit-alt">Alt text</Label>
                <Input
                  id="picker-edit-alt"
                  value={editAltText}
                  onChange={(e) => setEditAltText(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={actingId === editing.id}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {mode === "advanced" && allowManualUrl ? (
              <Button type="button" onClick={applyManualUrl} disabled={!manualUrl.trim()}>
                Use pasted URL
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
