"use client"

import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthSharePageTemplateSectionEditor } from "@/components/growth/share-pages/templates/growth-share-page-template-section-editor"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_LABELS,
  isTemplateBlockEnabled,
} from "@/lib/growth/share-pages/share-page-template-editor-utils"
import type { GrowthSharePageTemplateBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import type { GrowthBookingPageListItem } from "@/lib/growth/booking/booking-page-types"
import { cn } from "@/lib/utils"

export function GrowthSharePageTemplateCanvas({
  blocks,
  expandedBlockId,
  bookingPages,
  onExpandedBlockIdChange,
  onBlocksChange,
  onMove,
  onRemove,
  disabled,
}: {
  blocks: GrowthSharePageTemplateBlock[]
  expandedBlockId: string | null
  bookingPages: GrowthBookingPageListItem[]
  onExpandedBlockIdChange: (blockId: string | null) => void
  onBlocksChange: (blocks: GrowthSharePageTemplateBlock[]) => void
  onMove: (blockId: string, direction: -1 | 1) => void
  onRemove: (blockId: string) => void
  disabled?: boolean
}) {
  if (blocks.length === 0) {
    return (
      <GrowthEngineCard className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-foreground">Empty canvas</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Add a section from the palette to start building your share page template.
        </p>
      </GrowthEngineCard>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const expanded = expandedBlockId === block.id
        const enabled = isTemplateBlockEnabled(block)

        return (
          <GrowthEngineCard
            key={block.id}
            className={cn("overflow-hidden", !enabled && "opacity-60")}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <GripVertical className="size-4 text-muted-foreground" aria-hidden />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onExpandedBlockIdChange(expanded ? null : block.id)}
              >
                <span className="truncate text-sm font-semibold">
                  {GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_LABELS[block.type]}
                </span>
                {block.label ? (
                  <span className="truncate text-xs text-muted-foreground">· {block.label}</span>
                ) : null}
                {!enabled ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">Disabled</span>
                ) : null}
              </button>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" disabled={disabled || index === 0} onClick={() => onMove(block.id, -1)}>
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === blocks.length - 1}
                  onClick={() => onMove(block.id, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={() => onRemove(block.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {expanded ? (
              <div className="space-y-4 p-4">
                <GrowthSharePageTemplateSectionEditor
                  block={block}
                  blocks={blocks}
                  bookingPages={bookingPages}
                  disabled={disabled}
                  onChange={(next) =>
                    onBlocksChange(blocks.map((entry) => (entry.id === block.id ? next : entry)))
                  }
                />
              </div>
            ) : null}
          </GrowthEngineCard>
        )
      })}
    </div>
  )
}
