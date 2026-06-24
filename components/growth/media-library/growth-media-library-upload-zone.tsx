"use client"

import { useCallback, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR } from "@/lib/growth/media-library/growth-media-library-types"

type Props = {
  disabled?: boolean
  uploading?: boolean
  uploadLabel?: string
  compact?: boolean
  className?: string
  onUpload: (file: File) => void | Promise<void>
}

export function GrowthMediaLibraryUploadZone({
  disabled,
  uploading,
  uploadLabel = "Upload Image",
  compact,
  className,
  onUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      void onUpload(file)
    },
    [onUpload],
  )

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "rounded-lg border border-dashed p-6 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/20",
          disabled || uploading ? "opacity-60" : "cursor-pointer hover:border-primary/40 hover:bg-muted/30",
          compact ? "p-4" : "p-8",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          if (disabled || uploading) return
          setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          if (disabled || uploading) return
          handleFiles(event.dataTransfer.files)
        }}
        onClick={() => {
          if (disabled || uploading) return
          fileInputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (disabled || uploading) return
            fileInputRef.current?.click()
          }
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Uploading…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Drop image here</p>
            <p className="text-xs text-muted-foreground">or</p>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              {uploadLabel}
            </Button>
            <p className="text-[11px] text-muted-foreground">PNG, JPG, or WebP · max 5MB</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}
