"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { GrowthSharePagePreviewCard } from "@/components/growth/share-pages/growth-share-page-preview-card"
import type { GrowthSharePageOperatorPreviewModel } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"
import { cn } from "@/lib/utils"

export function GrowthSharePagePreviewPanel({
  preview,
  previewUrl,
}: {
  preview: GrowthSharePageOperatorPreviewModel
  previewUrl: string | null
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section className="rounded-lg border" aria-labelledby="sp-live-preview">
      <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <h3 id="sp-live-preview" className="text-sm font-semibold">
          Live page preview
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          aria-controls="sp-live-preview-panel"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Collapse" : "Expand"}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      <div className={cn("p-4", !expanded && "hidden lg:block")} id="sp-live-preview-panel">
        <div className="mb-3 hidden lg:block">
          <h3 className="text-sm font-semibold">Live page preview</h3>
          <p className="text-xs text-muted-foreground">Preview only — no tracking changes.</p>
        </div>

        {previewUrl ? (
          <div className="mb-3 rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Preview link: </span>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {previewUrl}
            </a>
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            Regenerate preview from Manage or use session-stored preview tokens after create.
          </p>
        )}

        <GrowthSharePagePreviewCard model={preview.model} className="max-h-[720px] overflow-y-auto" />
      </div>
    </section>
  )
}
