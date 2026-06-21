"use client"

import { useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GROWTH_VIDEO_MAX_UPLOAD_BYTES } from "@/lib/growth/videos/growth-video-types"
import type { GrowthVideoAsset } from "@/lib/growth/videos/growth-video-types"
import { uploadGrowthVideoFile } from "@/components/growth/videos/use-growth-video-assets"

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

export function GrowthVideoUploadModal({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (asset: GrowthVideoAsset) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function reset() {
    setTitle("")
    setDescription("")
    setFile(null)
    setStatus(null)
    setError(null)
    setUploading(false)
  }

  async function handleUpload() {
    if (!file) {
      setError("Select a video file.")
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Allowed types: MP4, WebM, MOV.")
      return
    }
    if (file.size > GROWTH_VIDEO_MAX_UPLOAD_BYTES) {
      setError("File exceeds 250 MB limit.")
      return
    }

    setUploading(true)
    setError(null)
    const result = await uploadGrowthVideoFile({
      title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
      description: description.trim() || undefined,
      file,
      onProgress: setStatus,
    })
    setUploading(false)

    if (!result.ok) {
      setError(result.error ?? "Upload failed")
      return
    }

    onUploaded(result.asset)
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!uploading) {
          onOpenChange(next)
          if (!next) reset()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload video</DialogTitle>
          <DialogDescription>MP4, WebM, or MOV up to 250 MB. Human-supervised upload only.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="video-title">Title</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              disabled={uploading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="video-description">Description</Label>
            <Input
              id="video-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={uploading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="video-file">File</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {status ? <p className="text-xs text-muted-foreground">Status: {status.replace(/_/g, " ")}</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={() => void handleUpload()} disabled={uploading || !file}>
            {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
