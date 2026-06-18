"use client"

import { use, useEffect, useState } from "react"
import { Eye } from "lucide-react"
import { GrowthSharePageTemplatePreviewPage } from "@/components/growth/share-pages/templates/growth-share-page-template-preview-page"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePageTemplatePreviewRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [template, setTemplate] = useState<GrowthSharePageTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`/api/platform/growth/share-pages/templates/${id}`)
      .then((res) => res.json())
      .then((data: { ok: boolean; template?: GrowthSharePageTemplate; message?: string }) => {
        if (!data.template) {
          setError(data.message ?? "Template not found")
          return
        }
        setTemplate(data.template)
      })
      .catch(() => setError("Failed to load template preview"))
      .finally(() => setLoading(false))
  }, [id])

  useGrowthBreadcrumbDetail(template?.name, loading)

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Template Preview"
        description="Responsive preview of the current template draft or published version."
        icon={Eye}
        iconClassName="bg-violet-50 text-violet-600"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {template ? <GrowthSharePageTemplatePreviewPage template={template} /> : null}
    </GrowthWorkspacePageContent>
  )
}
