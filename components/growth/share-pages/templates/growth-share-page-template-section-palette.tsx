"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_LABELS,
} from "@/lib/growth/share-pages/share-page-template-editor-utils"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES,
  type GrowthSharePageTemplateBlockType,
} from "@/lib/growth/share-pages/share-page-template-block-types"

const PALETTE_GROUPS: Array<{ title: string; types: GrowthSharePageTemplateBlockType[] }> = [
  {
    title: "Core sections",
    types: ["hero", "text", "image", "cta", "calendar", "testimonials", "custom"],
  },
  {
    title: "Media placeholders",
    types: ["video_placeholder", "voice_placeholder", "media_cta_placeholder"],
  },
]

export function GrowthSharePageTemplateSectionPalette({
  onAdd,
  disabled,
}: {
  onAdd: (type: GrowthSharePageTemplateBlockType) => void
  disabled?: boolean
}) {
  return (
    <GrowthEngineCard className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Section palette</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add reusable sections to the canvas. Media placeholders are labels only in S1-C.
        </p>
      </div>

      {PALETTE_GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{group.title}</p>
          <div className="flex flex-col gap-2">
            {group.types.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                className="justify-start"
                disabled={disabled}
                onClick={() => onAdd(type)}
              >
                <Plus className="mr-2 size-3.5" />
                {GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        Supported types: {GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES.length}. No uploads or live media in this phase.
      </p>
    </GrowthEngineCard>
  )
}
