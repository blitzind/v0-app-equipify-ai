"use client"

import { Loader2, Copy, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { GrowthMediaLibraryAsset } from "@/lib/growth/media-library/growth-media-library-types"
import { growthMediaLibraryKindLabel } from "@/lib/growth/media-library/growth-media-library-categories"
import {
  formatGrowthMediaLibraryDate,
  formatGrowthMediaLibraryDimensions,
} from "@/lib/growth/media-library/growth-media-library-format"

type Props = {
  asset: GrowthMediaLibraryAsset
  selected?: boolean
  highlighted?: boolean
  acting?: boolean
  showCategory?: boolean
  onSelect?: (asset: GrowthMediaLibraryAsset) => void
  onEdit?: (asset: GrowthMediaLibraryAsset) => void
  onArchive?: (asset: GrowthMediaLibraryAsset) => void
  onCopyUrl?: (asset: GrowthMediaLibraryAsset) => void
}

export function GrowthMediaLibraryAssetCard({
  asset,
  selected,
  highlighted,
  acting,
  showCategory = true,
  onSelect,
  onEdit,
  onArchive,
  onCopyUrl,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-3 transition",
        highlighted && "border-primary ring-2 ring-primary/20",
        selected && "border-primary bg-primary/5",
      )}
      data-qa="growth-media-library-asset-card"
    >
      <button
        type="button"
        className="mb-3 flex h-32 w-full items-center justify-center rounded-md bg-muted/30 p-2"
        onClick={() => onSelect?.(asset)}
        disabled={!onSelect}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.previewUrl || asset.publicUrl}
          alt={asset.altText ?? asset.title}
          className="max-h-full max-w-full object-contain"
        />
      </button>

      <div className="mb-3 space-y-1">
        <p className="truncate text-sm font-medium">{asset.title || "Untitled"}</p>
        {showCategory ? (
          <p className="text-xs text-muted-foreground">{growthMediaLibraryKindLabel(asset.libraryKind)}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {formatGrowthMediaLibraryDimensions(asset)} · {formatGrowthMediaLibraryDate(asset.createdAt)}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        {onSelect ? (
          <Button type="button" size="sm" variant="default" onClick={() => onSelect(asset)}>
            Select
          </Button>
        ) : null}
        {onEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(asset)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
        {onCopyUrl ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onCopyUrl(asset)}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy URL
          </Button>
        ) : null}
        {onArchive ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting}
            onClick={() => onArchive(asset)}
          >
            {acting ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3.5 w-3.5" />
            )}
            Archive
          </Button>
        ) : null}
      </div>
    </div>
  )
}
