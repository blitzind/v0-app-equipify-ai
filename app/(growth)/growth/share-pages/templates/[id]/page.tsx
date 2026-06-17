"use client"

import { use } from "react"
import { LayoutTemplate } from "lucide-react"
import { GrowthSharePageTemplateEditor } from "@/components/growth/share-pages/templates/growth-share-page-template-editor"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthSharePageTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Edit Share Page Template"
        description="Build sections, theme, and metadata before publishing to the library."
        icon={LayoutTemplate}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthSharePageTemplateEditor templateId={id} />
    </div>
  )
}
