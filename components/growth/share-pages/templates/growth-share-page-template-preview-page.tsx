"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GrowthSharePageTemplatePreviewContextPanel,
} from "@/components/growth/share-pages/templates/growth-share-page-template-preview-context-panel"
import {
  GrowthSharePageTemplatePreviewRenderer,
} from "@/components/growth/share-pages/templates/growth-share-page-template-preview-renderer"
import type { GrowthSharePageTemplatePreviewViewport } from "@/lib/growth/share-pages/share-page-template-preview-context"
import {
  createDefaultTemplateEditorDraft,
  type GrowthSharePageTemplateEditorDraft,
} from "@/lib/growth/share-pages/share-page-template-editor-utils"
import {
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
  type GrowthSharePageTemplatePreviewContext,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"

function draftFromTemplate(template: GrowthSharePageTemplate): GrowthSharePageTemplateEditorDraft {
  const version = template.currentVersion
  return {
    metadata: {
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      previewImageUrl: template.previewImageUrl,
    },
    blocks: version?.blocks ?? createDefaultTemplateEditorDraft().blocks,
    theme: version?.theme ?? createDefaultTemplateEditorDraft().theme,
    defaultBookingPageId: version?.defaultBookingPageId ?? null,
  }
}

export function GrowthSharePageTemplatePreviewPage({
  template,
}: {
  template: GrowthSharePageTemplate
}) {
  const draft = useMemo(() => draftFromTemplate(template), [template])
  const [viewport, setViewport] = useState<GrowthSharePageTemplatePreviewViewport>("desktop")
  const [previewContext, setPreviewContext] = useState<GrowthSharePageTemplatePreviewContext>(
    DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/growth/share-pages/templates/${template.id}`}>
            <ArrowLeft className="mr-1.5 size-3.5" />
            Back to editor
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {(["desktop", "tablet", "mobile"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={viewport === option ? "default" : "outline"}
              onClick={() => setViewport(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      <GrowthSharePageTemplatePreviewContextPanel context={previewContext} onChange={setPreviewContext} />

      <GrowthSharePageTemplatePreviewRenderer
        draft={draft}
        viewport={viewport}
        previewContext={previewContext}
      />
    </div>
  )
}
