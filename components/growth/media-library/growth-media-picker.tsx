"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageIcon, Loader2, Upload, X } from "lucide-react"
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
import {
  GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR,
  type GrowthMediaLibraryAsset,
  type GrowthMediaLibraryKind,
} from "@/lib/growth/media-library/growth-media-library-types"
import {
  listGrowthMediaLibraryAssets,
  uploadGrowthMediaLibraryFile,
} from "@/lib/growth/media-library/growth-media-library-upload"
import { buildGrowthMediaLibraryPublicUrl } from "@/lib/growth/media-library/growth-media-library-url"

type AcceptedKind = GrowthMediaLibraryKind

type Props = {
  value?: string
  onChange: (url: string, asset?: GrowthMediaLibraryAsset) => void
  acceptedTypes?: AcceptedKind[]
  label?: string
  allowManualUrl?: boolean
  disabled?: boolean
  id?: string
}

function defaultLibraryKind(acceptedTypes?: AcceptedKind[]): GrowthMediaLibraryKind {
  if (acceptedTypes?.includes("logo")) return "logo"
  if (acceptedTypes?.includes("avatar")) return "avatar"
  return "image"
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [manualUrl, setManualUrl] = useState(value ?? "")
  const [showManual, setShowManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<GrowthMediaLibraryAsset[]>([])
  const [filter, setFilter] = useState<GrowthMediaLibraryKind | "all">("all")

  const previewUrl = value?.trim() || ""
  const libraryKind = defaultLibraryKind(acceptedTypes)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const kind = filter === "all" ? undefined : filter
      const next = await listGrowthMediaLibraryAssets({ libraryKind: kind })
      const filtered =
        acceptedTypes && acceptedTypes.length > 0
          ? next.filter((item) => acceptedTypes.includes(item.libraryKind))
          : next
      setItems(filtered)
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

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const result = await uploadGrowthMediaLibraryFile({
        file,
        libraryKind: libraryKind,
        title: file.name,
      })
      onChange(result.publicUrl, result.asset)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  function selectAsset(asset: GrowthMediaLibraryAsset) {
    const origin = typeof window !== "undefined" ? window.location.origin : null
    const url = asset.publicUrl || buildGrowthMediaLibraryPublicUrl(asset.id, origin)
    onChange(url, asset)
    setOpen(false)
  }

  function applyManualUrl() {
    onChange(manualUrl.trim())
    setOpen(false)
  }

  return (
    <div className="space-y-2" data-qa="growth-media-picker">
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
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
          Select from library
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
          Upload new
        </Button>
        {value?.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void handleUpload(file)
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
          </DialogHeader>

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
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadItems()}>
              Refresh
            </Button>
            {allowManualUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowManual((v) => !v)}>
                {showManual ? "Hide manual URL" : "Paste manual URL"}
              </Button>
            ) : null}
          </div>

          {showManual && allowManualUrl ? (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <Label htmlFor="growth-media-picker-manual-url">Manual image URL</Label>
              <Input
                id="growth-media-picker-manual-url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
              <p className="text-xs text-muted-foreground">Advanced fallback — prefer library assets for reuse.</p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assets…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media assets yet. Upload an image to get started.</p>
          ) : (
            <div className="grid max-h-[360px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {items.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="rounded-lg border border-border p-2 text-left transition hover:border-primary/40 hover:bg-muted/30"
                  onClick={() => selectAsset(asset)}
                >
                  <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-muted/30 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.previewUrl || asset.publicUrl}
                      alt={asset.altText ?? asset.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="truncate text-xs font-medium">{asset.title || "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{asset.libraryKind}</p>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            {showManual && allowManualUrl ? (
              <Button type="button" onClick={applyManualUrl} disabled={!manualUrl.trim()}>
                Use manual URL
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
