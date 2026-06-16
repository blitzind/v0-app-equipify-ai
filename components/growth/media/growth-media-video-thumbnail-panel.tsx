"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { GrowthMediaVideoThumbnailSummary } from "@/lib/growth/media/media-video-thumbnail-types"
import {
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS,
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
} from "@/lib/growth/media/media-video-thumbnail-types"
import {
  extractVideoThumbnailFromBlob,
  uploadVideoThumbnailBlob,
} from "@/lib/growth/media/media-video-thumbnail-utils"

type ThumbnailResponse = {
  ok: boolean
  has_thumbnail?: boolean
  thumbnail?: GrowthMediaVideoThumbnailSummary | null
  thumbnail_storage_key?: string | null
  error?: string
}

export function GrowthMediaVideoThumbnailPanel({
  videoAssetId,
  disabled,
  localVideoBlob,
  captureTimestampSeconds = DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS,
}: {
  videoAssetId: string | null
  disabled?: boolean
  localVideoBlob?: Blob | null
  captureTimestampSeconds?: number
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("none")
  const [thumbnail, setThumbnail] = useState<GrowthMediaVideoThumbnailSummary | null>(null)

  const refreshThumbnail = useCallback(async () => {
    if (!videoAssetId) {
      setThumbnail(null)
      setStatus("none")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/media-assets/video/${videoAssetId}/thumbnail`)
      const data = (await response.json()) as ThumbnailResponse
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Could not load thumbnail metadata.")
        setThumbnail(null)
        setStatus("missing")
        return
      }
      setThumbnail(data.thumbnail ?? null)
      setStatus(data.has_thumbnail ? "ready" : "missing")
    } catch {
      setError("Failed to load thumbnail metadata.")
      setThumbnail(null)
      setStatus("missing")
    } finally {
      setLoading(false)
    }
  }, [videoAssetId])

  useEffect(() => {
    void refreshThumbnail()
  }, [refreshThumbnail])

  const uploadBlob = useCallback(
    async (blob: Blob, replaceExisting: boolean) => {
      if (!videoAssetId || disabled) return
      setUploading(true)
      setUploadProgress(0)
      setError(null)
      try {
        await uploadVideoThumbnailBlob({
          videoAssetId,
          blob,
          mimeType: DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
          captureTimestampSeconds,
          replaceExisting,
          onProgress: setUploadProgress,
        })
        await refreshThumbnail()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Thumbnail upload failed.")
      } finally {
        setUploading(false)
      }
    },
    [captureTimestampSeconds, disabled, refreshThumbnail, videoAssetId],
  )

  const generateFromLocalVideo = useCallback(async () => {
    if (!localVideoBlob) {
      setError("No local recording/file is available for client-side thumbnail extraction.")
      return
    }
    try {
      const blob = await extractVideoThumbnailFromBlob(localVideoBlob, { captureTimestampSeconds })
      await uploadBlob(blob, Boolean(thumbnail?.storageKey))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Thumbnail generation failed.")
    }
  }, [captureTimestampSeconds, localVideoBlob, thumbnail?.storageKey, uploadBlob])

  const removeThumbnail = useCallback(async () => {
    if (!videoAssetId || disabled) return
    setUploading(true)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/media-assets/video/${videoAssetId}/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      })
      const data = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "thumbnail_remove_failed")
      }
      setThumbnail(null)
      setStatus("removed")
      await refreshThumbnail()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove thumbnail.")
    } finally {
      setUploading(false)
    }
  }, [disabled, refreshThumbnail, videoAssetId])

  if (!videoAssetId) {
    return (
      <p className="text-xs text-muted-foreground">
        Attach or upload a video asset to manage thumbnails.
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div>
        <p className="text-sm font-medium">Video thumbnail (S2-C)</p>
        <p className="text-xs text-muted-foreground">
          Static image preview only — client canvas extraction or image upload. No video playback or transcoding.
        </p>
      </div>

      {loading ? <p className="text-xs text-muted-foreground">Loading thumbnail status…</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Status:</span> {status}
        {thumbnail?.captureTimestampSeconds != null
          ? ` · capture @ ${thumbnail.captureTimestampSeconds}s`
          : null}
      </p>

      {thumbnail?.previewUrl ? (
        <div className="overflow-hidden rounded-md border border-border bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail.previewUrl}
            alt="Video thumbnail preview"
            className="max-h-40 w-full object-cover"
          />
        </div>
      ) : thumbnail?.storageKey ? (
        <p className="text-xs text-muted-foreground">Thumbnail stored at {thumbnail.storageKey}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No thumbnail yet — server-side generation is not enabled; use client extraction or upload.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading || !localVideoBlob}
          onClick={() => void generateFromLocalVideo()}
        >
          {thumbnail?.storageKey ? "Replace from recording" : "Generate from recording"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload thumbnail
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading || !thumbnail?.storageKey}
          onClick={() => void removeThumbnail()}
        >
          Remove thumbnail
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          void uploadBlob(file, Boolean(thumbnail?.storageKey))
        }}
      />

      {uploading ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Uploading thumbnail… {uploadProgress}%</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
