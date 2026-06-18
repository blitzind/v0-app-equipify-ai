"use client"

import { use } from "react"
import { LayoutTemplate } from "lucide-react"
import { GrowthSharePageTemplateEditor } from "@/components/growth/share-pages/templates/growth-share-page-template-editor"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePageTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Edit Share Page Template"
        description="Build sections, theme, and metadata before publishing to the library."
        icon={LayoutTemplate}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthSharePageTemplateEditor templateId={id} />
    </GrowthWorkspacePageContent>
  )
}
