"use client"

import { useCallback, useState } from "react"
import { File, FileSpreadsheet, FileText, ImageIcon, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  attachmentKindFromMime,
  type AttachmentMediaKind,
} from "@/lib/attachments/attachment-media-kind"

const ICON_BOX = "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground"

function KindIcon({ kind, className }: { kind: AttachmentMediaKind; className?: string }) {
  const c = cn("size-[18px]", className)
  switch (kind) {
    case "image":
      return <ImageIcon className={c} aria-hidden />
    case "pdf":
      return <FileText className={c} aria-hidden />
    case "csv":
      return <Table2 className={c} aria-hidden />
    case "spreadsheet":
      return <FileSpreadsheet className={c} aria-hidden />
    case "document":
      return <FileText className={c} aria-hidden />
    default:
      return <File className={c} aria-hidden />
  }
}

export type AttachmentPreviewProps = {
  mimeType: string
  fileName?: string | null
  /** When set and MIME is an image, show a thumbnail (e.g. same-origin download URL). */
  thumbnailSrc?: string | null
  size?: "sm" | "md"
  className?: string
}

/**
 * Thumbnail for images when `thumbnailSrc` loads; otherwise a consistent type icon in a tile.
 */
export function AttachmentPreview({ mimeType, fileName, thumbnailSrc, size = "sm", className }: AttachmentPreviewProps) {
  const kind = attachmentKindFromMime(mimeType, fileName)
  const [imgFailed, setImgFailed] = useState(false)
  const showThumb = Boolean(thumbnailSrc) && kind === "image" && !imgFailed
  const dim = size === "md" ? "size-12" : "size-10"

  const onImgError = useCallback(() => setImgFailed(true), [])

  if (showThumb) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/30",
          dim,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc!}
          alt=""
          className="size-full object-cover"
          onError={onImgError}
        />
      </div>
    )
  }

  return (
    <div className={cn(ICON_BOX, dim, "border-dashed", className)} title={fileName ?? undefined}>
      <KindIcon kind={kind} />
    </div>
  )
}

/** Icon-only variant (e.g. compact list) — decorative; pair with visible filename text. */
export function AttachmentTypeIcon({
  mimeType,
  fileName,
  className,
}: {
  mimeType: string
  fileName?: string | null
  className?: string
}) {
  const kind = attachmentKindFromMime(mimeType, fileName)
  return (
    <span className={cn(ICON_BOX, "size-9", className)}>
      <KindIcon kind={kind} />
    </span>
  )
}
